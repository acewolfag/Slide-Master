import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, templatesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { parseToken } from "./auth";
import { carts, getCartId } from "./cart";

const router = Router();

function formatOrder(o: typeof ordersTable.$inferSelect) {
  return {
    id: o.id,
    status: o.status,
    total: parseFloat(String(o.total)),
    currency: o.currency,
    items: o.items as any[],
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    paymentMethod: o.paymentMethod,
    qrCode: o.qrCode,
    transferContent: o.transferContent,
    expiresAt: o.expiresAt?.toISOString() ?? null,
    paidAt: o.paidAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    downloadLinks: [],
  };
}

router.get("/orders", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const payload = parseToken(authHeader.slice(7));
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

  const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, payload.userId)).orderBy(desc(ordersTable.createdAt));
  res.json(orders.map(formatOrder));
});

router.post("/orders", async (req, res): Promise<void> => {
  const cartId = getCartId(req);
  const cart = carts.get(cartId);
  if (!cart || cart.items.length === 0) {
    res.status(400).json({ error: "Giỏ hàng trống" });
    return;
  }

  const { customerName, customerEmail, customerPhone, voucherCode, needVatInvoice, companyName, taxCode } = req.body;
  if (!customerName || !customerEmail) { res.status(400).json({ error: "Họ tên và email là bắt buộc" }); return; }

  let userId: number | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const payload = parseToken(authHeader.slice(7));
    if (payload) userId = payload.userId;
  }

  const subtotal = cart.items.reduce((s: number, i: any) => s + i.price, 0);
  const discount = cart.discount;
  const total = Math.max(0, subtotal - discount);

  const orderCode = `2GRILS ORD${Date.now().toString().slice(-6)}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const [order] = await db.insert(ordersTable).values({
    userId: userId ?? null,
    customerName,
    customerEmail,
    customerPhone: customerPhone ?? null,
    status: "pending",
    total: String(total),
    currency: "VND",
    items: cart.items,
    paymentMethod: "VietQR",
    qrCode: `https://api.vietqr.io/image/970415-1234567890-compact.jpg?amount=${total}&addInfo=${orderCode}&accountName=2GRILS+PPT`,
    transferContent: orderCode,
    needVatInvoice: needVatInvoice ?? false,
    companyName: companyName ?? null,
    taxCode: taxCode ?? null,
    voucherCode: cart.appliedVoucher ?? null,
    discountAmount: String(discount),
    expiresAt,
  }).returning();

  carts.delete(cartId);
  res.status(201).json(formatOrder(order));
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Not found" }); return; }

  res.json(formatOrder(order));
});

router.get("/orders/:id/payment-status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Not found" }); return; }

  let status = order.status;
  if (status === "pending" && order.expiresAt && order.expiresAt < new Date()) {
    status = "failed";
  }

  res.json({
    orderId: order.id,
    status: status === "pending" && order.expiresAt && order.expiresAt < new Date() ? "expired" : status,
    paidAt: order.paidAt?.toISOString() ?? null,
  });
});

router.get("/library", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const payload = parseToken(authHeader.slice(7));
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

  const paidOrders = await db.select().from(ordersTable).where(eq(ordersTable.userId, payload.userId));
  const libraryItems: any[] = [];
  for (const order of paidOrders) {
    const items = order.items as any[];
    for (const item of items) {
      libraryItems.push({
        templateId: item.templateId,
        titleVi: item.titleVi,
        titleEn: item.titleEn,
        thumbnailUrl: item.thumbnailUrl,
        purchasedAt: order.createdAt.toISOString(),
        downloadUrl: `/api/download/${item.templateId}?token=demo`,
      });
    }
  }
  res.json(libraryItems);
});

export default router;
