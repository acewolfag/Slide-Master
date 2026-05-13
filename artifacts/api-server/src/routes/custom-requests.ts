import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { customRequestsTable, customRequestMessagesTable, ordersTable, usersTable } from "@workspace/db";
import type { CustomRequestFile, StaffPermissions } from "@workspace/db";
import { eq, asc, desc, and, gt } from "drizzle-orm";
import { parseToken } from "./auth";
import { buildQrCode } from "./orders";
import { syncCustomRequestPayment } from "../lib/payments";
import { logger } from "../lib/logger";
import { validateAll, validateCustomerName, validateEmail, validatePhone, validateText } from "../lib/validators";

/**
 * Generate a unique order code suitable for SePay transferContent.
 * Format: 2GRILS ORD<timestamp-suffix><random-hex> — long enough to be
 * collision-free under heavy concurrent load.
 */
function generateOrderCode(): string {
  const ts = Date.now().toString().slice(-6);
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `2GRILS ORD${ts}${rand}`;
}

const router = Router();

type CustomRequest = typeof customRequestsTable.$inferSelect;

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function formatRequest(r: CustomRequest) {
  return {
    id: r.id,
    requestId: r.requestId,
    userId: r.userId,
    status: r.status,
    slideType: r.slideType,
    slideCount: r.slideCount,
    targetAudience: r.targetAudience,
    objective: r.objective,
    deadline: r.deadline,
    style: r.style,
    colorPalette: r.colorPalette,
    aspectRatio: r.aspectRatio,
    language: r.language,
    budget: r.budget,
    notes: r.notes,
    company: r.company,
    attachments: (r.attachments ?? []) as CustomRequestFile[],
    quotedPrice: num(r.quotedPrice),
    depositAmount: num(r.depositAmount),
    finalAmount: num(r.finalAmount),
    depositOrderId: r.depositOrderId,
    finalOrderId: r.finalOrderId,
    depositPaidAt: r.depositPaidAt?.toISOString() ?? null,
    finalPaidAt: r.finalPaidAt?.toISOString() ?? null,
    quoteMessage: r.quoteMessage,
    customerFeedback: r.customerFeedback,
    demoFiles: (r.demoFiles ?? []) as CustomRequestFile[],
    finalFiles: (r.finalFiles ?? []) as CustomRequestFile[],
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function generateRequestId(): string {
  const year = new Date().getFullYear();
  // 8 hex chars from CSPRNG — collision probability negligible vs. 4 digits.
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `CUSTOM-${year}-${rand}`;
}

async function getAuthUser(req: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const payload = parseToken(authHeader.slice(7));
  if (!payload) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  return user ?? null;
}

async function requireStaffOrAdmin(req: any, res: any): Promise<boolean> {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (user.role === "admin") return true;
  if (user.role === "staff") {
    const perms = (user.permissions ?? {}) as StaffPermissions;
    if (perms.manageCustomRequests) return true;
  }
  res.status(403).json({ error: "Forbidden" });
  return false;
}

async function loadByRequestId(requestId: string): Promise<CustomRequest | null> {
  const [r] = await db
    .select()
    .from(customRequestsTable)
    .where(eq(customRequestsTable.requestId, requestId));
  return r ?? null;
}

function sanitizeFiles(input: unknown): CustomRequestFile[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((f): f is CustomRequestFile => !!f && typeof f === "object" && typeof (f as any).url === "string")
    .map((f) => ({
      name: String(f.name ?? ""),
      url: String(f.url),
      type: String(f.type ?? ""),
      size: typeof f.size === "number" ? f.size : undefined,
    }));
}

// =====================================================================
// Customer-facing endpoints
// =====================================================================

router.get("/custom-requests", async (req, res): Promise<void> => {
  const user = await getAuthUser(req);
  if (!user) {
    res.json([]);
    return;
  }
  const requests = await db
    .select()
    .from(customRequestsTable)
    .where(eq(customRequestsTable.userId, user.id))
    .orderBy(desc(customRequestsTable.createdAt));
  res.json(requests.map(formatRequest));
});

router.post("/custom-requests", async (req, res): Promise<void> => {
  const {
    customerName, customerEmail, customerPhone, company,
    slideType, targetAudience, objective, slideCount,
    style, colorPalette, aspectRatio, language,
    deadline, budget, notes, attachments,
  } = req.body;

  if (!customerName || !customerEmail || !slideType || !slideCount || !deadline || !language) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const validation = validateAll(
    validateCustomerName(customerName),
    validateEmail(customerEmail),
    validatePhone(customerPhone),
    validateText(slideType, { maxLength: 100, fieldName: "Loại slide" }),
    validateText(notes, { maxLength: 5000, fieldName: "Ghi chú" }),
    validateText(targetAudience, { maxLength: 500, fieldName: "Đối tượng" }),
    validateText(objective, { maxLength: 1000, fieldName: "Mục tiêu" }),
    validateText(company, { maxLength: 200, fieldName: "Công ty" }),
  );
  if (!validation.ok) { res.status(400).json({ error: validation.error }); return; }

  const user = await getAuthUser(req);

  const [request] = await db.insert(customRequestsTable).values({
    requestId: generateRequestId(),
    userId: user?.id ?? null,
    status: "pending",
    customerName,
    customerEmail,
    customerPhone: customerPhone ?? null,
    company: company ?? null,
    slideType,
    targetAudience: targetAudience ?? null,
    objective: objective ?? null,
    slideCount: Number(slideCount),
    style: style ?? null,
    colorPalette: colorPalette ?? null,
    aspectRatio: aspectRatio ?? "16:9",
    language,
    deadline,
    budget: budget ?? null,
    notes: notes ?? null,
    attachments: sanitizeFiles(attachments),
  }).returning();

  res.status(201).json(formatRequest(request));
});

/**
 * Strict ownership check: caller must be authenticated, AND must be either
 * the owner (r.userId === user.id), an admin, or staff with manageCustomRequests.
 * Anonymous custom-requests (r.userId === null) can only be operated on by
 * staff/admin — never by other anonymous callers.
 */
async function requireOwnerOrStaff(
  req: any,
  res: any,
  r: CustomRequest,
): Promise<boolean> {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (user.role === "admin") return true;
  if (user.role === "staff") {
    const perms = (user.permissions ?? {}) as StaffPermissions;
    if (perms.manageCustomRequests) return true;
  }
  if (r.userId !== null && r.userId === user.id) return true;
  res.status(403).json({ error: "Forbidden" });
  return false;
}

router.get("/custom-requests/:id", async (req, res): Promise<void> => {
  const r = await loadByRequestId(req.params.id);
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!(await requireOwnerOrStaff(req, res, r))) return;
  res.json(formatRequest(r));
});

router.post("/custom-requests/:id/pay-deposit", async (req, res): Promise<void> => {
  const r = await loadByRequestId(req.params.id);
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!(await requireOwnerOrStaff(req, res, r))) return;
  const user = await getAuthUser(req);
  if (r.status !== "quoted") {
    res.status(400).json({ error: "Yêu cầu chưa được báo giá hoặc đã ở trạng thái khác" });
    return;
  }
  // Idempotency: if a deposit order already exists, return it instead of
  // creating a duplicate. Prevents double-charge on UI double-click / retry.
  if (r.depositOrderId) {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, r.depositOrderId));
    if (existing && existing.status === "pending") {
      res.json({
        orderId: existing.id,
        total: parseFloat(String(existing.total)),
        qrCode: existing.qrCode,
        transferContent: existing.transferContent,
        expiresAt: existing.expiresAt?.toISOString() ?? null,
      });
      return;
    }
  }
  const deposit = num(r.depositAmount);
  if (!deposit || deposit <= 0) {
    res.status(400).json({ error: "Số tiền cọc chưa được xác định" });
    return;
  }

  const orderCode = generateOrderCode();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const [order] = await db.insert(ordersTable).values({
    userId: user?.id ?? null,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    status: "pending",
    total: String(deposit),
    currency: "VND",
    items: [{ kind: "custom-request-deposit", requestId: r.requestId, slideCount: r.slideCount }],
    paymentMethod: "VietQR",
    qrCode: buildQrCode(orderCode, deposit),
    transferContent: orderCode,
    expiresAt,
  }).returning();

  await db
    .update(customRequestsTable)
    .set({ depositOrderId: order.id })
    .where(eq(customRequestsTable.id, r.id));

  res.status(201).json({
    orderId: order.id,
    total: deposit,
    qrCode: order.qrCode,
    transferContent: order.transferContent,
    expiresAt: order.expiresAt?.toISOString() ?? null,
  });
});

router.post("/custom-requests/:id/approve-demo", async (req, res): Promise<void> => {
  const r = await loadByRequestId(req.params.id);
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!(await requireOwnerOrStaff(req, res, r))) return;
  if (r.status !== "review") {
    res.status(400).json({ error: "Yêu cầu chưa ở trạng thái review" });
    return;
  }
  const fbInput = req.body?.feedback;
  const fbCheck = validateText(fbInput, { maxLength: 2000, fieldName: "Phản hồi" });
  if (!fbCheck.ok) { res.status(400).json({ error: fbCheck.error }); return; }
  const feedback = typeof fbInput === "string" ? fbInput : null;
  // After approval, admin still needs to polish/finalize the deck before
  // requesting the final payment. The customer waits in `finalizing`.
  const [updated] = await db
    .update(customRequestsTable)
    .set({ status: "finalizing", customerFeedback: feedback })
    .where(eq(customRequestsTable.id, r.id))
    .returning();
  res.json(formatRequest(updated));
});

router.post("/custom-requests/:id/reject-demo", async (req, res): Promise<void> => {
  const r = await loadByRequestId(req.params.id);
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await requireOwnerOrStaff(req, res, r))) return;
  if (r.status !== "review") {
    res.status(400).json({ error: "Yêu cầu chưa ở trạng thái review" });
    return;
  }
  const fbInput = req.body?.feedback;
  const fbCheck = validateText(fbInput, { maxLength: 2000, fieldName: "Lý do từ chối" });
  if (!fbCheck.ok) { res.status(400).json({ error: fbCheck.error }); return; }
  const feedback = typeof fbInput === "string" ? fbInput.trim() : null;
  // Send back to in-progress so admin can rework the demo.
  const [updated] = await db
    .update(customRequestsTable)
    .set({ status: "in-progress", customerFeedback: feedback })
    .where(eq(customRequestsTable.id, r.id))
    .returning();
  res.json(formatRequest(updated));
});

router.post("/custom-requests/:id/pay-final", async (req, res): Promise<void> => {
  const r = await loadByRequestId(req.params.id);
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!(await requireOwnerOrStaff(req, res, r))) return;
  const user = await getAuthUser(req);
  if (r.status !== "final-payment") {
    res.status(400).json({ error: "Yêu cầu chưa duyệt demo hoặc đã ở trạng thái khác" });
    return;
  }
  const final = num(r.finalAmount);
  if (!final || final <= 0) {
    res.status(400).json({ error: "Số tiền cuối chưa được xác định" });
    return;
  }
  if (r.finalPaidAt) {
    res.status(400).json({ error: "Đã thanh toán cuối" });
    return;
  }
  // Idempotency
  if (r.finalOrderId) {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, r.finalOrderId));
    if (existing && existing.status === "pending") {
      res.json({
        orderId: existing.id,
        total: parseFloat(String(existing.total)),
        qrCode: existing.qrCode,
        transferContent: existing.transferContent,
        expiresAt: existing.expiresAt?.toISOString() ?? null,
      });
      return;
    }
  }

  const orderCode = generateOrderCode();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const [order] = await db.insert(ordersTable).values({
    userId: user?.id ?? null,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    status: "pending",
    total: String(final),
    currency: "VND",
    items: [{ kind: "custom-request-final", requestId: r.requestId, slideCount: r.slideCount }],
    paymentMethod: "VietQR",
    qrCode: buildQrCode(orderCode, final),
    transferContent: orderCode,
    expiresAt,
  }).returning();

  await db
    .update(customRequestsTable)
    .set({ finalOrderId: order.id })
    .where(eq(customRequestsTable.id, r.id));

  res.status(201).json({
    orderId: order.id,
    total: final,
    qrCode: order.qrCode,
    transferContent: order.transferContent,
    expiresAt: order.expiresAt?.toISOString() ?? null,
  });
});

// =====================================================================
// Admin / staff endpoints
// =====================================================================

router.get("/admin/custom-requests/:id", async (req, res): Promise<void> => {
  if (!(await requireStaffOrAdmin(req, res))) return;
  const r = await loadByRequestId(req.params.id);
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(formatRequest(r));
});

router.post("/admin/custom-requests/:id/quote", async (req, res): Promise<void> => {
  if (!(await requireStaffOrAdmin(req, res))) return;
  const r = await loadByRequestId(req.params.id);
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { quotedPrice, depositAmount, quoteMessage } = req.body ?? {};
  const quoted = Number(quotedPrice);
  const deposit = Number(depositAmount);
  if (!Number.isFinite(quoted) || quoted <= 0) {
    res.status(400).json({ error: "quotedPrice phải lớn hơn 0" });
    return;
  }
  if (!Number.isFinite(deposit) || deposit < 0 || deposit > quoted) {
    res.status(400).json({ error: "depositAmount phải nằm trong [0, quotedPrice]" });
    return;
  }
  const finalAmt = Math.max(0, quoted - deposit);
  const [updated] = await db
    .update(customRequestsTable)
    .set({
      status: "quoted",
      quotedPrice: String(quoted),
      depositAmount: String(deposit),
      finalAmount: String(finalAmt),
      quoteMessage: typeof quoteMessage === "string" ? quoteMessage : null,
    })
    .where(eq(customRequestsTable.id, r.id))
    .returning();
  logger.info({ requestId: r.requestId, quoted, deposit }, "Custom request quoted");
  res.json(formatRequest(updated));
});

router.post("/admin/custom-requests/:id/start-work", async (req, res): Promise<void> => {
  if (!(await requireStaffOrAdmin(req, res))) return;
  const r = await loadByRequestId(req.params.id);
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (r.status !== "deposit-paid") {
    res.status(400).json({ error: "Yêu cầu chưa thanh toán cọc" });
    return;
  }
  const [updated] = await db
    .update(customRequestsTable)
    .set({ status: "in-progress" })
    .where(eq(customRequestsTable.id, r.id))
    .returning();
  res.json(formatRequest(updated));
});

// Admin signals that the post-approval polishing is done and the customer
// can now pay the remaining balance.
router.post("/admin/custom-requests/:id/notify-done", async (req, res): Promise<void> => {
  if (!(await requireStaffOrAdmin(req, res))) return;
  const r = await loadByRequestId(req.params.id);
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  if (r.status !== "finalizing") {
    res.status(400).json({ error: "Yêu cầu chưa ở trạng thái hoàn thiện" });
    return;
  }
  const [updated] = await db
    .update(customRequestsTable)
    .set({ status: "final-payment" })
    .where(eq(customRequestsTable.id, r.id))
    .returning();
  res.json(formatRequest(updated));
});

router.post("/admin/custom-requests/:id/upload-demo", async (req, res): Promise<void> => {
  if (!(await requireStaffOrAdmin(req, res))) return;
  const r = await loadByRequestId(req.params.id);
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Only allow uploading demo while building or already in review (re-upload).
  if (r.status !== "in-progress" && r.status !== "review" && r.status !== "deposit-paid") {
    res.status(400).json({ error: `Không thể upload demo ở trạng thái ${r.status}` });
    return;
  }
  const files = sanitizeFiles(req.body?.files);
  if (files.length === 0) {
    res.status(400).json({ error: "Cần ít nhất 1 file demo" });
    return;
  }
  const [updated] = await db
    .update(customRequestsTable)
    .set({ demoFiles: files, status: "review" })
    .where(eq(customRequestsTable.id, r.id))
    .returning();
  res.json(formatRequest(updated));
});

router.post("/admin/custom-requests/:id/upload-final", async (req, res): Promise<void> => {
  if (!(await requireStaffOrAdmin(req, res))) return;
  const r = await loadByRequestId(req.params.id);
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!r.finalPaidAt) {
    res.status(400).json({ error: "Khách chưa thanh toán phần cuối" });
    return;
  }
  const files = sanitizeFiles(req.body?.files);
  if (files.length === 0) {
    res.status(400).json({ error: "Cần ít nhất 1 file cuối" });
    return;
  }
  const [updated] = await db
    .update(customRequestsTable)
    .set({ finalFiles: files, status: "delivered" })
    .where(eq(customRequestsTable.id, r.id))
    .returning();
  res.json(formatRequest(updated));
});

// Repair: re-run sync if a deposit/final order was paid but the custom-request
// state didn't follow. Useful when SePay confirmed a transfer before the order
// was linked, or when a previous sync failed.
router.post("/admin/custom-requests/:id/sync-payment", async (req, res): Promise<void> => {
  if (!(await requireStaffOrAdmin(req, res))) return;
  const r = await loadByRequestId(req.params.id);
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const results: { orderId: number; synced: boolean; kind?: "deposit" | "final" }[] = [];

  if (r.depositOrderId) {
    const [depOrder] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, r.depositOrderId));
    if (depOrder?.status === "paid") {
      const result = await syncCustomRequestPayment(depOrder.id, depOrder.paidAt ?? new Date());
      results.push({ orderId: depOrder.id, synced: !!result, kind: "deposit" });
    } else {
      results.push({ orderId: r.depositOrderId, synced: false, kind: "deposit" });
    }
  }
  if (r.finalOrderId) {
    const [finOrder] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, r.finalOrderId));
    if (finOrder?.status === "paid") {
      const result = await syncCustomRequestPayment(finOrder.id, finOrder.paidAt ?? new Date());
      results.push({ orderId: finOrder.id, synced: !!result, kind: "final" });
    } else {
      results.push({ orderId: r.finalOrderId, synced: false, kind: "final" });
    }
  }

  const updated = await loadByRequestId(req.params.id);
  res.json({ syncResults: results, request: updated ? formatRequest(updated) : null });
});

/**
 * Edit notes/quotedPrice only — status transitions MUST go through dedicated
 * endpoints (`/quote`, `/start-work`, `/upload-demo`, `/upload-final`,
 * `/approve-demo`, `/sync-payment`) which enforce the proper workflow and
 * payment checks. Free-form status PATCH was previously allowed but it
 * bypassed payment/quote requirements.
 */
router.patch("/admin/custom-requests/:id/status", async (req, res): Promise<void> => {
  if (!(await requireStaffOrAdmin(req, res))) return;
  const r = await loadByRequestId(req.params.id);
  if (!r) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { status, quotedPrice, notes } = req.body ?? {};
  if (status !== undefined) {
    res.status(400).json({
      error:
        "Không được PATCH status trực tiếp. Dùng các endpoint chuyên dụng: /quote, /start-work, /upload-demo, /upload-final.",
    });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (quotedPrice !== undefined) {
    const qp = Number(quotedPrice);
    if (!Number.isFinite(qp) || qp < 0) {
      res.status(400).json({ error: "quotedPrice không hợp lệ" });
      return;
    }
    updateData.quotedPrice = String(qp);
  }
  if (notes !== undefined) updateData.notes = String(notes ?? "");
  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "Không có trường nào để cập nhật (chỉ chấp nhận quotedPrice, notes)" });
    return;
  }
  const [updated] = await db
    .update(customRequestsTable)
    .set(updateData)
    .where(eq(customRequestsTable.id, r.id))
    .returning();
  res.json(formatRequest(updated));
});

// =====================================================================
// Messaging: chat between the customer and admin/staff about a request.
// Available once work has started (in-progress) and through delivery.
// =====================================================================

const MESSAGEABLE_STATUSES = new Set([
  "in-progress",
  "review",
  "finalizing",
  "final-payment",
  "delivered",
]);

function formatMessage(m: typeof customRequestMessagesTable.$inferSelect) {
  return {
    id: m.id,
    requestId: m.requestId,
    authorId: m.authorId,
    authorRole: m.authorRole,
    authorName: m.authorName,
    body: m.body,
    attachments: (m.attachments ?? []) as CustomRequestFile[],
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/custom-requests/:id/messages", async (req, res): Promise<void> => {
  const r = await loadByRequestId(req.params.id);
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await requireOwnerOrStaff(req, res, r))) return;

  // `after` lets the client poll incrementally with the id of the last
  // message it already has, avoiding refetching the full thread every tick.
  const afterRaw = req.query.after;
  const after = typeof afterRaw === "string" ? parseInt(afterRaw, 10) : NaN;

  const where = Number.isFinite(after)
    ? and(
        eq(customRequestMessagesTable.requestId, r.id),
        gt(customRequestMessagesTable.id, after),
      )
    : eq(customRequestMessagesTable.requestId, r.id);

  const rows = await db
    .select()
    .from(customRequestMessagesTable)
    .where(where)
    .orderBy(asc(customRequestMessagesTable.createdAt), asc(customRequestMessagesTable.id));

  res.json({ items: rows.map(formatMessage) });
});

router.post("/custom-requests/:id/messages", async (req, res): Promise<void> => {
  const r = await loadByRequestId(req.params.id);
  if (!r) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await requireOwnerOrStaff(req, res, r))) return;

  if (!MESSAGEABLE_STATUSES.has(r.status)) {
    res.status(400).json({
      error: `Chỉ có thể nhắn tin khi đơn ở trạng thái thực hiện trở đi (hiện: ${r.status})`,
    });
    return;
  }

  const user = await getAuthUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const bodyRaw = req.body?.body;
  const body = typeof bodyRaw === "string" ? bodyRaw.trim() : "";
  const attachments = sanitizeFiles(req.body?.attachments);

  if (!body && attachments.length === 0) {
    res.status(400).json({ error: "Tin nhắn phải có nội dung hoặc file đính kèm" });
    return;
  }
  if (body.length > 4000) {
    res.status(400).json({ error: "Tin nhắn quá dài (tối đa 4000 ký tự)" });
    return;
  }

  const isStaff = user.role === "admin" || user.role === "staff";
  // The author's role is snapshot at write time. The owner check above already
  // guarantees a customer-author can only post on their own request.
  const authorRole: "customer" | "admin" | "staff" = isStaff
    ? user.role === "admin"
      ? "admin"
      : "staff"
    : "customer";

  const [created] = await db
    .insert(customRequestMessagesTable)
    .values({
      requestId: r.id,
      authorId: user.id,
      authorRole,
      authorName: user.name ?? user.email ?? (isStaff ? "Staff" : "Khách hàng"),
      body,
      attachments,
    })
    .returning();

  res.status(201).json(formatMessage(created));
});

export default router;
