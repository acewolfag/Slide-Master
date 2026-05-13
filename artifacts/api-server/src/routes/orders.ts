import { Router } from "express";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { ordersTable, templatesTable, vouchersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { parseToken } from "./auth";
import { carts, getCartId } from "./cart";
import { buildSepayQrUrl, readSepayConfig } from "../lib/sepay";
import { logger } from "../lib/logger";
import { validateAll, validateCustomerName, validateEmail, validatePhone } from "../lib/validators";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../../uploads");

function generateOrderCode(): string {
  const ts = Date.now().toString().slice(-6);
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `2GRILS ORD${ts}${rand}`;
}

const router = Router();

export function buildQrCode(orderCode: string, total: number): string {
  const sepay = readSepayConfig();
  if (sepay) {
    return buildSepayQrUrl({
      bankCode: sepay.bankCode,
      accountNumber: sepay.accountNumber,
      accountName: sepay.accountName,
      amount: total,
      transferContent: orderCode,
    });
  }
  logger.warn(
    "SePay config missing (SEPAY_BANK_CODE / SEPAY_ACCOUNT_NUMBER / SEPAY_ACCOUNT_NAME / SEPAY_API_KEY) - falling back to placeholder VietQR",
  );
  const params = new URLSearchParams({
    amount: String(Math.round(total)),
    addInfo: orderCode,
    accountName: "2GRILS PPT",
  });
  return `https://api.vietqr.io/image/970415-1234567890-compact.jpg?${params.toString()}`;
}

function formatOrder(o: typeof ordersTable.$inferSelect) {
  const items = (o.items as Array<{ templateId: number; titleVi: string; titleEn: string; thumbnailUrl: string }>) ?? [];
  const downloadLinks =
    o.status === "paid"
      ? items.map((i) => ({
          templateId: i.templateId,
          titleVi: i.titleVi,
          titleEn: i.titleEn,
          thumbnailUrl: i.thumbnailUrl,
          downloadUrl: `/api/download/${i.templateId}?orderId=${o.id}`,
        }))
      : [];
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
    downloadLinks,
  };
}

// Public payment info — used by checkout/order-success pages to show
// the correct bank details (mirrors what SePay QR encodes).
router.get("/payment-info", async (_req, res): Promise<void> => {
  const sepay = readSepayConfig();
  if (!sepay) {
    res.json({ configured: false });
    return;
  }
  res.json({
    configured: true,
    bankCode: sepay.bankCode,
    accountNumber: sepay.accountNumber,
    accountName: sepay.accountName,
  });
});

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
  void voucherCode;
  if (!customerName || !customerEmail) { res.status(400).json({ error: "Họ tên và email là bắt buộc" }); return; }
  const v = validateAll(
    validateCustomerName(customerName),
    validateEmail(customerEmail),
    validatePhone(customerPhone),
  );
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }

  let userId: number | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const payload = parseToken(authHeader.slice(7));
    if (payload) userId = payload.userId;
  }

  const subtotal = cart.items.reduce((s: number, i: any) => s + i.price, 0);

  // Re-validate voucher at order creation. The cart may have applied a
  // voucher minutes (or hours) ago — by now it could be expired, disabled,
  // or its usage limit consumed.
  let discount = cart.discount;
  let appliedVoucherCode = cart.appliedVoucher ?? null;
  if (appliedVoucherCode) {
    const [v] = await db
      .select()
      .from(vouchersTable)
      .where(eq(vouchersTable.code, appliedVoucherCode));
    const now = new Date();
    const stillValid =
      v &&
      v.isActive &&
      (!v.expiresAt || v.expiresAt > now) &&
      v.usageCount < v.usageLimit &&
      (!v.minOrderAmount || subtotal >= parseFloat(String(v.minOrderAmount)));
    if (!stillValid) {
      logger.info(
        { code: appliedVoucherCode, userId, subtotal },
        "Voucher invalidated at order creation",
      );
      discount = 0;
      appliedVoucherCode = null;
    }
  }
  // Cap discount at subtotal — never let total go negative or grow above subtotal.
  if (discount < 0) discount = 0;
  if (discount > subtotal) discount = subtotal;
  const total = Math.max(0, subtotal - discount);

  const orderCode = generateOrderCode();
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
    qrCode: buildQrCode(orderCode, total),
    transferContent: orderCode,
    needVatInvoice: needVatInvoice ?? false,
    companyName: companyName ?? null,
    taxCode: taxCode ?? null,
    voucherCode: appliedVoucherCode,
    discountAmount: String(discount),
    expiresAt,
  }).returning();

  carts.delete(cartId);
  res.status(201).json(formatOrder(order));
});

/**
 * Authorize access to an order:
 *   - If order has userId → require Bearer token of that user (or admin)
 *   - If order is anonymous (userId null) → orderId acts as the bearer
 *     (matches the email receipt link trust model)
 */
async function canAccessOrder(req: any, order: typeof ordersTable.$inferSelect): Promise<boolean> {
  if (!order.userId) return true; // anonymous order: orderId is the bearer
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return false;
  const payload = parseToken(authHeader.slice(7));
  if (!payload) return false;
  if (payload.userId === order.userId) return true;
  // Allow admins to view any order
  const { usersTable } = await import("@workspace/db");
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  return user?.role === "admin";
}

router.get("/orders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canAccessOrder(req, order))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(formatOrder(order));
});

router.get("/orders/:id/payment-status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  if (!(await canAccessOrder(req, order))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

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

  const paidOrders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, payload.userId));

  // Dedupe by templateId — show each template once with the most recent
  // purchase. Skip non-template items (e.g. custom-request-deposit kind which
  // has no templateId field) and orders not yet paid.
  type LibItem = {
    templateId: number;
    titleVi: string;
    titleEn: string;
    thumbnailUrl: string;
    purchasedAt: string;
    downloadUrl: string;
    purchaseCount: number;
  };
  const byTemplate = new Map<number, LibItem>();
  for (const order of paidOrders) {
    if (order.status !== "paid") continue;
    const items = (order.items as Array<{ templateId?: number; titleVi: string; titleEn: string; thumbnailUrl: string }>) ?? [];
    for (const item of items) {
      if (typeof item?.templateId !== "number" || item.templateId <= 0) continue;
      const existing = byTemplate.get(item.templateId);
      if (existing) {
        existing.purchaseCount += 1;
        // Keep newest purchase + downloadUrl
        if (order.createdAt.toISOString() > existing.purchasedAt) {
          existing.purchasedAt = order.createdAt.toISOString();
          existing.downloadUrl = `/api/download/${item.templateId}?orderId=${order.id}`;
        }
      } else {
        byTemplate.set(item.templateId, {
          templateId: item.templateId,
          titleVi: item.titleVi,
          titleEn: item.titleEn,
          thumbnailUrl: item.thumbnailUrl,
          purchasedAt: order.createdAt.toISOString(),
          downloadUrl: `/api/download/${item.templateId}?orderId=${order.id}`,
          purchaseCount: 1,
        });
      }
    }
  }
  const libraryItems = [...byTemplate.values()].sort((a, b) =>
    a.purchasedAt < b.purchasedAt ? 1 : -1,
  );
  res.json(libraryItems);
});

/**
 * Download a purchased template file.
 *
 * Auth model: orderId acts as a download token. The endpoint accepts the
 * download as long as:
 *   - orderId is a valid integer
 *   - the order exists and is paid
 *   - the order's items array contains the requested templateId
 *   - the template has a fileUrl set by an admin
 *
 * For extra safety: when the request includes a Bearer token AND the order
 * has a userId, the caller must match. Anonymous orders (no userId) can be
 * downloaded by anyone holding the orderId — same trust model as the email
 * receipt link.
 */
router.get("/download/:templateId", async (req, res): Promise<void> => {
  const templateId = parseInt(req.params.templateId, 10);
  const orderIdRaw = typeof req.query.orderId === "string" ? req.query.orderId : "";
  const orderId = parseInt(orderIdRaw, 10);
  if (!Number.isFinite(templateId) || templateId <= 0 || !Number.isFinite(orderId) || orderId <= 0) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) {
    res.status(404).json({ error: "Đơn hàng không tồn tại" });
    return;
  }
  if (order.status !== "paid") {
    res.status(403).json({ error: "Đơn hàng chưa được thanh toán" });
    return;
  }

  // If the order is tied to a user, require the caller to be that user
  // (or an admin). For anonymous orders the orderId itself is the bearer.
  if (order.userId) {
    const authHeader = req.headers.authorization;
    const payload = authHeader?.startsWith("Bearer ") ? parseToken(authHeader.slice(7)) : null;
    if (!payload || payload.userId !== order.userId) {
      // Allow if explicit ADMIN_DOWNLOAD_OVERRIDE is unset; otherwise check admin role.
      // For now be strict: only the owner can download user-scoped orders.
      res.status(403).json({ error: "Bạn không có quyền tải file của đơn này" });
      return;
    }
  }

  const items = (order.items as Array<{ templateId: number }>) ?? [];
  if (!items.some((i) => i?.templateId === templateId)) {
    res.status(403).json({ error: "Template không thuộc đơn hàng này" });
    return;
  }

  const [tpl] = await db.select().from(templatesTable).where(eq(templatesTable.id, templateId));
  if (!tpl) {
    res.status(404).json({ error: "Template không tồn tại" });
    return;
  }
  if (!tpl.fileUrl) {
    logger.warn({ templateId, orderId }, "Download requested but template has no fileUrl");
    res.status(404).json({
      error: "Template chưa có file để tải về. Vui lòng liên hệ admin.",
    });
    return;
  }

  // External URL — redirect to it (e.g. S3/R2 signed URL)
  if (/^https?:\/\//i.test(tpl.fileUrl)) {
    res.redirect(tpl.fileUrl);
    return;
  }

  // Local file under /api/uploads/. Strip the prefix and resolve safely.
  const relPath = tpl.fileUrl.replace(/^\/api\/uploads\//, "").replace(/^\/+/, "");
  if (!relPath || relPath.includes("..")) {
    res.status(400).json({ error: "Đường dẫn file không hợp lệ" });
    return;
  }
  const absPath = path.resolve(uploadsDir, relPath);
  const uploadsRoot = path.resolve(uploadsDir) + path.sep;
  if (!absPath.startsWith(uploadsRoot)) {
    logger.error({ templateId, fileUrl: tpl.fileUrl, absPath }, "Path traversal attempt in download");
    res.status(400).json({ error: "Đường dẫn file không hợp lệ" });
    return;
  }
  if (!fs.existsSync(absPath)) {
    logger.error({ templateId, absPath }, "Template file missing on disk");
    res.status(404).json({ error: "File không tồn tại trên server" });
    return;
  }

  // Suggest a friendly filename based on slug.
  const ext = path.extname(absPath) || ".pptx";
  const downloadName = `${tpl.slug}${ext}`;
  res.download(absPath, downloadName, (err) => {
    if (err) {
      logger.error({ err, templateId, orderId }, "Download stream failed");
    } else {
      logger.info({ templateId, orderId }, "Template downloaded");
    }
  });
});

export default router;
