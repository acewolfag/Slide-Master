import { db } from "@workspace/db";
import { ordersTable, vouchersTable, customRequestsTable } from "@workspace/db";
import { eq, sql, or } from "drizzle-orm";
import { sendEmail, escapeHtml } from "./email";
import { logger } from "./logger";

interface OrderItem {
  templateId: number;
  titleVi: string;
  titleEn: string;
  price: number;
  thumbnailUrl: string;
}

type Order = typeof ordersTable.$inferSelect;

export interface MarkPaidOptions {
  source: "sepay-webhook" | "admin-manual";
  sepayTransactionId?: string;
  webhookReceivedAt?: Date;
}

export interface MarkPaidResult {
  order: Order;
  alreadyPaid: boolean;
  voucherIncremented: boolean;
}

function renderConfirmationEmail(args: {
  orderCode: string;
  customerName: string;
  total: number;
  items: OrderItem[];
  publicBaseUrl: string;
}): { html: string; text: string } {
  const formatPrice = (n: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
  const itemsHtml = args.items
    .map((i) => `<li>${escapeHtml(i.titleVi)} - ${formatPrice(i.price)}</li>`)
    .join("");
  const itemsText = args.items.map((i) => `- ${i.titleVi}: ${formatPrice(i.price)}`).join("\n");
  const dashboardUrl = `${args.publicBaseUrl.replace(/\/$/, "")}/dashboard`;
  const html = `
    <div style="font-family: 'Be Vietnam Pro', system-ui, sans-serif; max-width: 560px; margin: 0 auto;">
      <h1 style="color:#00B14F;">Cam on ${escapeHtml(args.customerName)}!</h1>
      <p>Don hang <strong>${escapeHtml(args.orderCode)}</strong> da thanh toan thanh cong.</p>
      <p><strong>Tong:</strong> ${formatPrice(args.total)}</p>
      <ul>${itemsHtml}</ul>
      <p>Truy cap <a href="${escapeHtml(dashboardUrl)}">thu vien cua ban</a> de tai template.</p>
      <p style="color:#666;font-size:12px;margin-top:32px;">2Grils.PPT</p>
    </div>
  `;
  const text = `Cam on ${args.customerName}!\n\nDon ${args.orderCode} da thanh toan: ${formatPrice(
    args.total,
  )}\n\n${itemsText}\n\nThu vien: ${dashboardUrl}`;
  return { html, text };
}

/**
 * Sync custom-request state when its linked deposit/final order is paid.
 * Idempotent: skips if depositPaidAt / finalPaidAt already set.
 * Returns true if the custom-request was updated.
 */
export async function syncCustomRequestPayment(
  orderId: number,
  paidAt: Date = new Date(),
): Promise<{ requestId: string; kind: "deposit" | "final" } | null> {
  const [linkedRequest] = await db
    .select()
    .from(customRequestsTable)
    .where(
      or(
        eq(customRequestsTable.depositOrderId, orderId),
        eq(customRequestsTable.finalOrderId, orderId),
      ),
    );
  if (!linkedRequest) {
    logger.info({ orderId }, "syncCustomRequestPayment: no linked custom-request");
    return null;
  }

  if (linkedRequest.depositOrderId === orderId) {
    if (linkedRequest.depositPaidAt) {
      logger.info(
        { customRequestId: linkedRequest.requestId, orderId },
        "syncCustomRequestPayment: deposit already marked paid",
      );
      return null;
    }
    await db
      .update(customRequestsTable)
      .set({ status: "deposit-paid", depositPaidAt: paidAt })
      .where(eq(customRequestsTable.id, linkedRequest.id));
    logger.info(
      { customRequestId: linkedRequest.requestId, orderId },
      "Custom request deposit paid",
    );
    return { requestId: linkedRequest.requestId, kind: "deposit" };
  }

  if (linkedRequest.finalOrderId === orderId) {
    if (linkedRequest.finalPaidAt) {
      logger.info(
        { customRequestId: linkedRequest.requestId, orderId },
        "syncCustomRequestPayment: final already marked paid",
      );
      return null;
    }
    await db
      .update(customRequestsTable)
      .set({ finalPaidAt: paidAt })
      .where(eq(customRequestsTable.id, linkedRequest.id));
    logger.info(
      { customRequestId: linkedRequest.requestId, orderId },
      "Custom request final payment received",
    );
    return { requestId: linkedRequest.requestId, kind: "final" };
  }

  return null;
}

export async function markOrderPaid(
  orderId: number,
  opts: MarkPaidOptions,
): Promise<MarkPaidResult | null> {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) return null;

  if (order.status === "paid") {
    if (opts.sepayTransactionId) {
      await db
        .update(ordersTable)
        .set({
          sepayTransactionId: opts.sepayTransactionId,
          webhookReceivedAt: opts.webhookReceivedAt ?? new Date(),
        })
        .where(eq(ordersTable.id, orderId));
    }
    // Even if the order was already marked paid earlier, ensure the linked
    // custom-request is in sync. This handles the case where the order was
    // paid before the custom-request was linked, or where a previous run
    // failed to update the custom-request.
    await syncCustomRequestPayment(orderId, order.paidAt ?? new Date());
    return { order, alreadyPaid: true, voucherIncremented: false };
  }

  const now = new Date();
  const [updated] = await db
    .update(ordersTable)
    .set({
      status: "paid",
      paidAt: now,
      sepayTransactionId: opts.sepayTransactionId ?? null,
      webhookReceivedAt:
        opts.webhookReceivedAt ?? (opts.source === "sepay-webhook" ? now : null),
    })
    .where(eq(ordersTable.id, orderId))
    .returning();

  let voucherIncremented = false;
  if (updated.voucherCode) {
    await db
      .update(vouchersTable)
      .set({ usageCount: sql`${vouchersTable.usageCount} + 1` })
      .where(eq(vouchersTable.code, updated.voucherCode));
    voucherIncremented = true;
  }

  await syncCustomRequestPayment(updated.id, now);

  const items = (updated.items as OrderItem[]) ?? [];
  const publicBaseUrl =
    process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 5173}`;
  const { html, text } = renderConfirmationEmail({
    orderCode: updated.transferContent ?? `ORDER-${updated.id}`,
    customerName: updated.customerName,
    total: parseFloat(String(updated.total)),
    items,
    publicBaseUrl,
  });

  sendEmail({
    to: updated.customerEmail,
    subject: `2Grils.PPT - Xac nhan don ${updated.transferContent ?? updated.id}`,
    html,
    text,
  })
    .then((r) => {
      if (!r.sent) {
        logger.warn({ orderId: updated.id, reason: r.reason }, "Confirmation email failed");
      }
    })
    .catch((err) => {
      logger.error({ err, orderId: updated.id }, "Confirmation email threw");
    });

  logger.info(
    { orderId: updated.id, source: opts.source, voucherIncremented },
    "Order marked paid",
  );

  return { order: updated, alreadyPaid: false, voucherIncremented };
}
