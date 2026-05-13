import { Router } from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import { db } from "@workspace/db";
import { ordersTable, templatesTable, customRequestsTable, usersTable, vouchersTable, reviewsTable, reviewCriteriaTable, reviewModerationTagsTable, blogPostsTable, categoriesTable, servicePricingTable, siteSettingsTable, passwordResetTokensTable } from "@workspace/db";
import type { StaffPermissions } from "@workspace/db";
import { eq, desc, and, or, sql, gte, asc, ilike, inArray } from "drizzle-orm";
import { parseToken, hashPassword } from "./auth";
import { markOrderPaid } from "../lib/payments";
import { sendEmail, escapeHtml } from "../lib/email";
import { logger } from "../lib/logger";
import { processTemplateArchive, renderPptxAssets } from "../lib/template-archive";

const router = Router();

type AuthUser = typeof usersTable.$inferSelect;

async function getAuthUser(req: any, res: any): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const payload = parseToken(authHeader.slice(7));
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return user;
}

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const user = await getAuthUser(req, res);
  if (!user) return false;
  if (user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return false; }
  return true;
}

async function requireAdminOrStaff(req: any, res: any, permission: keyof StaffPermissions): Promise<boolean> {
  const user = await getAuthUser(req, res);
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "staff") {
    const perms = (user.permissions ?? {}) as StaffPermissions;
    if (perms[permission]) return true;
    res.status(403).json({ error: "Quyền truy cập bị từ chối" });
    return false;
  }
  res.status(403).json({ error: "Forbidden" });
  return false;
}

router.get("/admin/stats", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const [{ totalRevenue }] = await db
    .select({ totalRevenue: sql<number>`coalesce(sum(total::numeric), 0)` })
    .from(ordersTable)
    .where(eq(ordersTable.status, "paid"));
  const [{ totalOrders }] = await db
    .select({ totalOrders: sql<number>`count(*)::int` })
    .from(ordersTable);
  const [{ pendingCustomRequests }] = await db
    .select({ pendingCustomRequests: sql<number>`count(*)::int` })
    .from(customRequestsTable)
    .where(eq(customRequestsTable.status, "pending"));

  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const [{ newCustomersThisMonth }] = await db
    .select({ newCustomersThisMonth: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(gte(usersTable.createdAt, monthAgo));

  // Revenue by day — last 7 days, real data from paid orders.
  // NOTE: timezone literal is hardcoded in the SQL because Postgres
  // `AT TIME ZONE` does not accept bound parameters via the pg driver.
  const TZ = "Asia/Ho_Chi_Minh";
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const dailyRows = await db
    .select({
      date: sql<string>`to_char(paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')`,
      revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
      orders: sql<number>`count(*)::int`,
    })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.status, "paid"),
        gte(ordersTable.paidAt, sevenDaysAgo),
      ),
    )
    .groupBy(sql`to_char(paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')`);

  const dailyMap = new Map(dailyRows.map((r) => [r.date, r]));
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const revenueByDay = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
    const date = dateFormatter.format(d); // YYYY-MM-DD in TZ
    const row = dailyMap.get(date);
    return {
      date,
      revenue: row ? parseFloat(String(row.revenue)) : 0,
      orders: row ? row.orders : 0,
    };
  });

  // Top templates by REAL revenue: aggregate from paid orders' items[].
  // items is jsonb array of { templateId, price, ... }. Use jsonb_array_elements.
  const templateRevenueRows = await db.execute<{
    templateId: number;
    revenue: number;
    salesCount: number;
  }>(sql`
    SELECT
      (item->>'templateId')::int AS "templateId",
      coalesce(sum((item->>'price')::numeric), 0) AS revenue,
      count(*)::int AS "salesCount"
    FROM ${ordersTable}, jsonb_array_elements(${ordersTable.items}) AS item
    WHERE ${ordersTable.status} = 'paid'
      AND item ? 'templateId'
    GROUP BY (item->>'templateId')::int
    ORDER BY revenue DESC
    LIMIT 8
  `);

  const rows = (templateRevenueRows as unknown as { rows?: Array<{ templateId: number; revenue: string | number; salesCount: number }> }).rows
    ?? (templateRevenueRows as unknown as Array<{ templateId: number; revenue: string | number; salesCount: number }>);

  const validRows = (rows ?? []).filter((r): r is { templateId: number; revenue: string | number; salesCount: number } =>
    !!r && typeof r.templateId === "number",
  );
  const templateIds = validRows.map((r) => r.templateId);
  const templatesById = new Map<number, { id: number; title: string; thumbnailUrl: string }>();
  if (templateIds.length > 0) {
    const tplRows = await db
      .select({ id: templatesTable.id, title: templatesTable.titleVi, thumbnailUrl: templatesTable.thumbnailUrl })
      .from(templatesTable)
      .where(inArray(templatesTable.id, templateIds));
    for (const t of tplRows) templatesById.set(t.id, t);
  }
  const topTemplatesByRevenue: Array<{
    id: number;
    title: string;
    thumbnailUrl: string;
    revenue: number;
    salesCount: number;
  }> = [];
  for (const r of validRows) {
    const t = templatesById.get(r.templateId);
    if (!t) continue;
    topTemplatesByRevenue.push({
      id: t.id,
      title: t.title,
      thumbnailUrl: t.thumbnailUrl,
      revenue: parseFloat(String(r.revenue)),
      salesCount: r.salesCount,
    });
  }

  // Fall back to salesCount-based ranking when no template-revenue data yet.
  const topTemplates = topTemplatesByRevenue.length > 0
    ? topTemplatesByRevenue.slice(0, 5).map(({ id, title, thumbnailUrl, salesCount, revenue }) => ({
        id, title, thumbnailUrl, salesCount, revenue,
      }))
    : (await db
        .select({
          id: templatesTable.id,
          title: templatesTable.titleVi,
          salesCount: templatesTable.salesCount,
          thumbnailUrl: templatesTable.thumbnailUrl,
        })
        .from(templatesTable)
        .orderBy(desc(templatesTable.salesCount))
        .limit(5)).map((t) => ({ ...t, revenue: 0 }));

  res.json({
    totalRevenue: parseFloat(String(totalRevenue)),
    totalOrders,
    pendingCustomRequests,
    newCustomersThisMonth,
    topTemplates,
    topTemplatesByRevenue,
    revenueByDay,
  });
});

router.get("/admin/templates", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const templates = await db.select().from(templatesTable).orderBy(desc(templatesTable.createdAt));
  const withCategory = await Promise.all(templates.map(async (t) => {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, t.categoryId));
    return {
      id: t.id, titleVi: t.titleVi, titleEn: t.titleEn, slug: t.slug,
      price: parseFloat(String(t.price)), isFree: t.isFree,
      thumbnailUrl: t.thumbnailUrl, previewImages: t.previewImages,
      fileUrl: t.fileUrl,
      slideCount: t.slideCount, aspectRatio: t.aspectRatio,
      categoryId: t.categoryId, categoryName: cat?.nameVi ?? "",
      style: t.style, tags: t.tags,
      isFeatured: t.isFeatured, isBestSeller: t.isBestSeller,
      avgRating: parseFloat(String(t.avgRating)), reviewCount: t.reviewCount,
      salesCount: t.salesCount, status: t.status,
      createdAt: t.createdAt.toISOString(),
    };
  }));
  res.json(withCategory);
});

router.post("/admin/templates", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const { titleVi, titleEn, slug, price, thumbnailUrl, fileUrl, previewImages, slideCount, aspectRatio, categoryId, style, isFree, isFeatured, descriptionVi, descriptionEn, features, tags, status } = req.body;
  const [template] = await db.insert(templatesTable).values({
    titleVi, titleEn, slug, price: String(price),
    thumbnailUrl, fileUrl: fileUrl ?? null,
    previewImages: previewImages ?? [],
    slideCount: Number(slideCount),
    aspectRatio, categoryId: Number(categoryId),
    style, isFree: isFree ?? false,
    isFeatured: isFeatured ?? false,
    descriptionVi, descriptionEn,
    features: features ?? [],
    tags: tags ?? [],
    status: status ?? "active",
  }).returning();
  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, template.categoryId));
  res.status(201).json({ ...template, categoryName: cat?.nameVi ?? "", price: parseFloat(String(template.price)), avgRating: 0, createdAt: template.createdAt.toISOString() });
});

router.put("/admin/templates/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Template id không hợp lệ" });
    return;
  }
  const { titleVi, titleEn, slug, price, thumbnailUrl, fileUrl, previewImages, slideCount, aspectRatio, categoryId, style, isFree, isFeatured, descriptionVi, descriptionEn, features, tags, status } = req.body;

  const [template] = await db.update(templatesTable).set({
    titleVi, titleEn, slug, price: String(price),
    thumbnailUrl, fileUrl: fileUrl ?? null,
    previewImages: previewImages ?? [],
    slideCount: Number(slideCount),
    aspectRatio, categoryId: Number(categoryId),
    style, isFree: isFree ?? false,
    isFeatured: isFeatured ?? false,
    descriptionVi, descriptionEn,
    features: features ?? [],
    tags: tags ?? [],
    status: status ?? "active",
  }).where(eq(templatesTable.id, id)).returning();
  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, template.categoryId));
  res.json({ ...template, categoryName: cat?.nameVi ?? "", price: parseFloat(String(template.price)), avgRating: parseFloat(String(template.avgRating)), createdAt: template.createdAt.toISOString() });
});

router.delete("/admin/templates/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Template id không hợp lệ" });
    return;
  }
  await db.delete(templatesTable).where(eq(templatesTable.id, id));
  res.json({ success: true });
});

router.get("/admin/orders", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const { status } = req.query as { status?: string };
  const conditions = status ? [eq(ordersTable.status, status as any)] : [];
  const orders = await db.select().from(ordersTable).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(ordersTable.createdAt));
  res.json(orders.map(o => ({
    id: o.id, status: o.status, total: parseFloat(String(o.total)),
    currency: o.currency, items: o.items,
    customerName: o.customerName, customerEmail: o.customerEmail,
    customerPhone: o.customerPhone, paymentMethod: o.paymentMethod,
    qrCode: o.qrCode, transferContent: o.transferContent,
    expiresAt: o.expiresAt?.toISOString() ?? null,
    paidAt: o.paidAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(), downloadLinks: [],
  })));
});

router.post("/admin/orders/:id/confirm", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) { res.status(400).json({ error: "Invalid order id" }); return; }
  const result = await markOrderPaid(id, { source: "admin-manual" });
  if (!result) { res.status(404).json({ error: "Order not found" }); return; }
  const order = result.order;
  res.json({ id: order.id, status: order.status, total: parseFloat(String(order.total)), currency: order.currency, items: order.items, customerName: order.customerName, customerEmail: order.customerEmail, customerPhone: order.customerPhone, paymentMethod: order.paymentMethod, qrCode: order.qrCode, transferContent: order.transferContent, expiresAt: order.expiresAt?.toISOString() ?? null, paidAt: order.paidAt?.toISOString() ?? null, createdAt: order.createdAt.toISOString(), downloadLinks: [], alreadyPaid: result.alreadyPaid, voucherIncremented: result.voucherIncremented });
});

router.get("/admin/custom-requests", async (req, res): Promise<void> => {
  const ok = await requireAdminOrStaff(req, res, "manageCustomRequests");
  if (!ok) return;
  const requests = await db.select().from(customRequestsTable).orderBy(desc(customRequestsTable.createdAt));
  const num = (v: unknown) => (v === null || v === undefined ? null : parseFloat(String(v)));
  res.json(requests.map(r => ({
    id: r.id, requestId: r.requestId, userId: r.userId, status: r.status,
    slideType: r.slideType, slideCount: r.slideCount, deadline: r.deadline,
    style: r.style, language: r.language, budget: r.budget, notes: r.notes,
    company: r.company, targetAudience: r.targetAudience, objective: r.objective,
    colorPalette: r.colorPalette, aspectRatio: r.aspectRatio,
    attachments: r.attachments ?? [],
    quotedPrice: num(r.quotedPrice),
    depositAmount: num(r.depositAmount),
    finalAmount: num(r.finalAmount),
    depositOrderId: r.depositOrderId,
    finalOrderId: r.finalOrderId,
    depositPaidAt: r.depositPaidAt?.toISOString() ?? null,
    finalPaidAt: r.finalPaidAt?.toISOString() ?? null,
    quoteMessage: r.quoteMessage,
    customerFeedback: r.customerFeedback,
    demoFiles: r.demoFiles ?? [],
    finalFiles: r.finalFiles ?? [],
    customerName: r.customerName, customerEmail: r.customerEmail, customerPhone: r.customerPhone,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

function formatAdminUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    permissions: u.permissions ?? null,
    avatarUrl: u.avatarUrl,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/admin/users", async (req, res): Promise<void> => {
  const ok = await requireAdminOrStaff(req, res, "manageUsers");
  if (!ok) return;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  let users;
  if (q.length > 0) {
    const pattern = `%${q}%`;
    users = await db
      .select()
      .from(usersTable)
      .where(or(ilike(usersTable.name, pattern), ilike(usersTable.email, pattern)))
      .orderBy(desc(usersTable.createdAt));
  } else {
    users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  }
  res.json(users.map(formatAdminUser));
});

router.put("/admin/users/:id/role", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  const { role, permissions } = req.body;
  const validRoles = ["customer", "admin", "designer", "staff"];
  if (!validRoles.includes(role)) { res.status(400).json({ error: "Invalid role" }); return; }
  const [updated] = await db.update(usersTable).set({ role, permissions: permissions ?? null }).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatAdminUser(updated));
});

// Admin/staff with manageUsers sets a user's password (manual support).
// Note: cannot reset password of another admin — escalation guard below.
router.post("/admin/users/:id/set-password", async (req, res): Promise<void> => {
  const ok = await requireAdminOrStaff(req, res, "manageUsers");
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { newPassword, notify } = req.body ?? {};
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "Mật khẩu phải tối thiểu 6 ký tự" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  // Privilege escalation guard: staff cannot reset password of an admin.
  const caller = await getAuthUser(req, res);
  if (!caller) return;
  if (user.role === "admin" && caller.role !== "admin") {
    res.status(403).json({ error: "Chỉ admin mới được đặt lại mật khẩu cho admin khác" });
    return;
  }
  await db
    .update(usersTable)
    .set({ passwordHash: hashPassword(newPassword) })
    .where(eq(usersTable.id, id));
  logger.info({ userId: id, by: caller.id, byRole: caller.role }, "Password reset by admin/staff");

  if (notify) {
    // Do NOT email the password itself — email a generic notification only.
    const html = `
      <p>Xin chào ${escapeHtml(user.name)},</p>
      <p>Quản trị viên đã đặt lại mật khẩu tài khoản của bạn.</p>
      <p>Vui lòng liên hệ quản trị viên để nhận mật khẩu mới qua kênh an toàn (không phải email),
         và đăng nhập rồi đổi lại mật khẩu ngay.</p>
    `;
    const result = await sendEmail({
      to: user.email,
      subject: "2Grils.PPT - Mật khẩu đã được đặt lại",
      html,
      text: "Mật khẩu của bạn đã được đặt lại bởi quản trị viên. Liên hệ để nhận mật khẩu mới qua kênh an toàn.",
    });
    if (!result.sent) {
      logger.warn({ userId: id, reason: result.reason }, "set-password notify email failed");
    }
  }
  res.json({ ok: true });
});

// Admin/staff with manageUsers generates a one-time reset link.
router.post("/admin/users/:id/send-reset-link", async (req, res): Promise<void> => {
  const ok = await requireAdminOrStaff(req, res, "manageUsers");
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const caller = await getAuthUser(req, res);
  if (!caller) return;
  if (user.role === "admin" && caller.role !== "admin") {
    res.status(403).json({ error: "Chỉ admin mới được gửi link reset cho admin khác" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await db.insert(passwordResetTokensTable).values({
    userId: id,
    token,
    expiresAt,
  });

  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:5173";
  const resetUrl = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${token}`;
  logger.info({ userId: id, expiresAt }, "Password reset link generated");

  const result = await sendEmail({
    to: user.email,
    subject: "2Grils.PPT - Đặt lại mật khẩu",
    html: `
      <p>Xin chào ${escapeHtml(user.name)},</p>
      <p>Bạn (hoặc quản trị viên) đã yêu cầu đặt lại mật khẩu.</p>
      <p>Click <a href="${escapeHtml(resetUrl)}">vào đây</a> để đặt lại mật khẩu (link có hiệu lực 1 giờ).</p>
      <p>Nếu không phải bạn, vui lòng bỏ qua email này.</p>
    `,
    text: `Đặt lại mật khẩu: ${resetUrl} (1 giờ)`,
  });
  if (!result.sent) {
    logger.warn({ userId: id, reason: result.reason }, "send-reset-link email failed");
  }

  res.json({ ok: true, sent: result.sent, resetUrl: result.sent ? null : resetUrl });
});

router.get("/admin/settings", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const rows = await db.select().from(siteSettingsTable);
  const result: Record<string, any> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
});

router.put("/admin/settings", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const settings = req.body as Record<string, any>;
  for (const [key, value] of Object.entries(settings)) {
    await db.insert(siteSettingsTable).values({ key, value }).onConflictDoUpdate({ target: siteSettingsTable.key, set: { value } });
  }
  const rows = await db.select().from(siteSettingsTable);
  const result: Record<string, any> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json(result);
});

router.get("/admin/vouchers", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const vouchers = await db.select().from(vouchersTable).orderBy(desc(vouchersTable.createdAt));
  res.json(vouchers.map(v => ({ id: v.id, code: v.code, discountType: v.discountType, discountValue: parseFloat(String(v.discountValue)), minOrderAmount: v.minOrderAmount ? parseFloat(String(v.minOrderAmount)) : null, expiresAt: v.expiresAt?.toISOString() ?? null, usageLimit: v.usageLimit, usageCount: v.usageCount, isActive: v.isActive, applicableCategory: v.applicableCategory, createdAt: v.createdAt.toISOString() })));
});

function validateVoucherValue(discountType: unknown, discountValue: unknown): string | null {
  if (discountType !== "percentage" && discountType !== "fixed") {
    return "discountType phải là 'percentage' hoặc 'fixed'";
  }
  const dv = Number(discountValue);
  if (!Number.isFinite(dv)) return "discountValue không hợp lệ";
  if (dv < 0) return "discountValue không được âm";
  if (discountType === "percentage" && dv > 100) {
    return "discountValue cho percentage tối đa 100";
  }
  if (discountType === "fixed" && dv > 1_000_000_000) {
    return "discountValue cho fixed tối đa 1 tỷ VND";
  }
  return null;
}

router.post("/admin/vouchers", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const { code, discountType, discountValue, minOrderAmount, expiresAt, usageLimit, applicableCategory } = req.body;
  if (!code || typeof code !== "string" || !/^[A-Z0-9_-]{3,40}$/i.test(code)) {
    res.status(400).json({ error: "Mã voucher 3-40 ký tự, chỉ chữ cái/số/_-" });
    return;
  }
  const valueErr = validateVoucherValue(discountType, discountValue);
  if (valueErr) { res.status(400).json({ error: valueErr }); return; }
  const ul = Number(usageLimit);
  if (!Number.isFinite(ul) || ul < 1 || ul > 1_000_000) {
    res.status(400).json({ error: "usageLimit phải nằm trong [1, 1.000.000]" });
    return;
  }
  if (minOrderAmount !== undefined && minOrderAmount !== null) {
    const moa = Number(minOrderAmount);
    if (!Number.isFinite(moa) || moa < 0) { res.status(400).json({ error: "minOrderAmount không hợp lệ" }); return; }
  }
  const [v] = await db.insert(vouchersTable).values({ code: code.toUpperCase(), discountType, discountValue: String(discountValue), minOrderAmount: minOrderAmount ? String(minOrderAmount) : null, expiresAt: expiresAt ? new Date(expiresAt) : null, usageLimit: ul, applicableCategory: applicableCategory ?? null }).returning();
  res.status(201).json({ id: v.id, code: v.code, discountType: v.discountType, discountValue: parseFloat(String(v.discountValue)), minOrderAmount: v.minOrderAmount ? parseFloat(String(v.minOrderAmount)) : null, expiresAt: v.expiresAt?.toISOString() ?? null, usageLimit: v.usageLimit, usageCount: v.usageCount, isActive: v.isActive, applicableCategory: v.applicableCategory, createdAt: v.createdAt.toISOString() });
});

router.patch("/admin/vouchers/:id", async (req, res): Promise<void> => {
  const ok = await requireAdminOrStaff(req, res, "manageVouchers");
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { isActive, expiresAt, discountValue, minOrderAmount, usageLimit, applicableCategory } = req.body ?? {};
  const update: Record<string, unknown> = {};
  if (typeof isActive === "boolean") update.isActive = isActive;
  if (expiresAt !== undefined) update.expiresAt = expiresAt ? new Date(expiresAt) : null;
  if (discountValue !== undefined) {
    // Need current voucher to know discountType for proper range check.
    const [current] = await db.select().from(vouchersTable).where(eq(vouchersTable.id, id));
    if (!current) { res.status(404).json({ error: "Voucher not found" }); return; }
    const valueErr = validateVoucherValue(current.discountType, discountValue);
    if (valueErr) { res.status(400).json({ error: valueErr }); return; }
    update.discountValue = String(Number(discountValue));
  }
  if (minOrderAmount !== undefined) update.minOrderAmount = minOrderAmount === null ? null : String(minOrderAmount);
  if (usageLimit !== undefined) {
    const ul = Number(usageLimit);
    if (!Number.isFinite(ul) || ul < 0) { res.status(400).json({ error: "usageLimit không hợp lệ" }); return; }
    update.usageLimit = ul;
  }
  if (applicableCategory !== undefined) update.applicableCategory = applicableCategory ?? null;

  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "Không có trường nào để cập nhật" });
    return;
  }

  const [v] = await db.update(vouchersTable).set(update).where(eq(vouchersTable.id, id)).returning();
  if (!v) { res.status(404).json({ error: "Voucher not found" }); return; }
  res.json({ id: v.id, code: v.code, discountType: v.discountType, discountValue: parseFloat(String(v.discountValue)), minOrderAmount: v.minOrderAmount ? parseFloat(String(v.minOrderAmount)) : null, expiresAt: v.expiresAt?.toISOString() ?? null, usageLimit: v.usageLimit, usageCount: v.usageCount, isActive: v.isActive, applicableCategory: v.applicableCategory, createdAt: v.createdAt.toISOString() });
});

// ---------------------------------------------------------------------------
// Reviews moderation
// ---------------------------------------------------------------------------

function formatReviewRow(r: typeof reviewsTable.$inferSelect, templateTitle?: string) {
  return {
    id: r.id,
    templateId: r.templateId,
    templateTitle: templateTitle ?? null,
    userId: r.userId,
    authorName: r.authorName,
    rating: r.rating,
    comment: r.comment,
    imageUrl: r.imageUrl,
    isVerifiedPurchase: r.isVerifiedPurchase,
    isHidden: r.isHidden,
    criteriaTags: r.criteriaTags ?? [],
    moderationTags: r.moderationTags ?? [],
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/admin/reviews", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const { rating, templateId, hidden, q, criteria, modTag, page = "1", limit = "20" } =
    req.query as Record<string, string>;

  const conds: any[] = [];
  if (rating) {
    const r = parseInt(rating, 10);
    if (r >= 1 && r <= 5) conds.push(eq(reviewsTable.rating, r));
  }
  if (templateId) {
    const t = parseInt(templateId, 10);
    if (!Number.isNaN(t)) conds.push(eq(reviewsTable.templateId, t));
  }
  if (hidden === "true") conds.push(eq(reviewsTable.isHidden, true));
  else if (hidden === "false") conds.push(eq(reviewsTable.isHidden, false));
  if (q && q.trim()) {
    conds.push(
      or(ilike(reviewsTable.comment, `%${q.trim()}%`), ilike(reviewsTable.authorName, `%${q.trim()}%`)),
    );
  }
  if (criteria && criteria.trim()) {
    // Postgres array contains: criteria_tags @> ARRAY[<slug>]
    conds.push(sql`${reviewsTable.criteriaTags} @> ARRAY[${criteria.trim()}]::text[]`);
  }
  if (modTag && modTag.trim()) {
    conds.push(sql`${reviewsTable.moderationTags} @> ARRAY[${modTag.trim()}]::text[]`);
  }

  const where = conds.length > 0 ? and(...conds) : undefined;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * lim;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(reviewsTable)
    .where(where ?? sql`true`);

  const rows = await db
    .select({
      r: reviewsTable,
      templateTitle: templatesTable.titleVi,
    })
    .from(reviewsTable)
    .leftJoin(templatesTable, eq(templatesTable.id, reviewsTable.templateId))
    .where(where ?? sql`true`)
    .orderBy(desc(reviewsTable.createdAt))
    .limit(lim)
    .offset(offset);

  res.json({
    items: rows.map((row) => formatReviewRow(row.r, row.templateTitle ?? undefined)),
    total,
    page: pageNum,
    limit: lim,
  });
});

router.patch("/admin/reviews/:id/hide", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(reviewsTable).set({ isHidden: true }).where(eq(reviewsTable.id, id));
  res.json({ success: true });
});

router.patch("/admin/reviews/:id/unhide", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(reviewsTable).set({ isHidden: false }).where(eq(reviewsTable.id, id));
  res.json({ success: true });
});

router.delete("/admin/reviews/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await db.delete(reviewsTable).where(eq(reviewsTable.id, id)).returning({ id: reviewsTable.id });
  if (result.length === 0) { res.status(404).json({ error: "Review not found" }); return; }
  res.json({ success: true });
});

router.patch("/admin/reviews/:id/moderation-tags", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const tags = req.body?.tags;
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")) {
    res.status(400).json({ error: "tags must be string[]" });
    return;
  }
  const [updated] = await db
    .update(reviewsTable)
    .set({ moderationTags: tags })
    .where(eq(reviewsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Review not found" }); return; }
  res.json(formatReviewRow(updated));
});

// ---------------------------------------------------------------------------
// Review criteria CRUD (admin)
// ---------------------------------------------------------------------------

function formatCriteria(c: typeof reviewCriteriaTable.$inferSelect) {
  return {
    id: c.id,
    slug: c.slug,
    labelVi: c.labelVi,
    labelEn: c.labelEn,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/admin/review-criteria", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const rows = await db
    .select()
    .from(reviewCriteriaTable)
    .orderBy(asc(reviewCriteriaTable.sortOrder), asc(reviewCriteriaTable.id));
  res.json(rows.map(formatCriteria));
});

router.post("/admin/review-criteria", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const { slug, labelVi, labelEn, sortOrder, isActive } = req.body ?? {};
  if (typeof slug !== "string" || !slug.trim()) {
    res.status(400).json({ error: "slug required" });
    return;
  }
  if (typeof labelVi !== "string" || !labelVi.trim()) {
    res.status(400).json({ error: "labelVi required" });
    return;
  }
  try {
    const [c] = await db
      .insert(reviewCriteriaTable)
      .values({
        slug: slug.trim(),
        labelVi: labelVi.trim(),
        labelEn: labelEn?.trim() || null,
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        isActive: isActive !== false,
      })
      .returning();
    res.status(201).json(formatCriteria(c));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "slug đã tồn tại" });
      return;
    }
    throw err;
  }
});

router.patch("/admin/review-criteria/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { labelVi, labelEn, sortOrder, isActive } = req.body ?? {};
  const update: Record<string, unknown> = {};
  if (typeof labelVi === "string" && labelVi.trim()) update.labelVi = labelVi.trim();
  if (labelEn !== undefined) update.labelEn = typeof labelEn === "string" && labelEn.trim() ? labelEn.trim() : null;
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) update.sortOrder = Number(sortOrder);
  if (typeof isActive === "boolean") update.isActive = isActive;
  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "Không có trường nào để cập nhật" });
    return;
  }
  const [c] = await db
    .update(reviewCriteriaTable)
    .set(update)
    .where(eq(reviewCriteriaTable.id, id))
    .returning();
  if (!c) { res.status(404).json({ error: "Criteria not found" }); return; }
  res.json(formatCriteria(c));
});

router.delete("/admin/review-criteria/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await db
    .delete(reviewCriteriaTable)
    .where(eq(reviewCriteriaTable.id, id))
    .returning({ id: reviewCriteriaTable.id });
  if (result.length === 0) { res.status(404).json({ error: "Criteria not found" }); return; }
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Moderation tags CRUD (admin)
// ---------------------------------------------------------------------------

function formatModerationTag(t: typeof reviewModerationTagsTable.$inferSelect) {
  return {
    id: t.id,
    slug: t.slug,
    labelVi: t.labelVi,
    color: t.color,
    sortOrder: t.sortOrder,
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/admin/moderation-tags", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const rows = await db
    .select()
    .from(reviewModerationTagsTable)
    .orderBy(asc(reviewModerationTagsTable.sortOrder), asc(reviewModerationTagsTable.id));
  res.json(rows.map(formatModerationTag));
});

router.post("/admin/moderation-tags", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const { slug, labelVi, color, sortOrder, isActive } = req.body ?? {};
  if (typeof slug !== "string" || !slug.trim()) {
    res.status(400).json({ error: "slug required" });
    return;
  }
  if (typeof labelVi !== "string" || !labelVi.trim()) {
    res.status(400).json({ error: "labelVi required" });
    return;
  }
  try {
    const [t] = await db
      .insert(reviewModerationTagsTable)
      .values({
        slug: slug.trim(),
        labelVi: labelVi.trim(),
        color: typeof color === "string" && color.trim() ? color.trim() : "red",
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
        isActive: isActive !== false,
      })
      .returning();
    res.status(201).json(formatModerationTag(t));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "slug đã tồn tại" });
      return;
    }
    throw err;
  }
});

router.patch("/admin/moderation-tags/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { labelVi, color, sortOrder, isActive } = req.body ?? {};
  const update: Record<string, unknown> = {};
  if (typeof labelVi === "string" && labelVi.trim()) update.labelVi = labelVi.trim();
  if (typeof color === "string" && color.trim()) update.color = color.trim();
  if (sortOrder !== undefined && Number.isFinite(Number(sortOrder))) update.sortOrder = Number(sortOrder);
  if (typeof isActive === "boolean") update.isActive = isActive;
  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "Không có trường nào để cập nhật" });
    return;
  }
  const [t] = await db
    .update(reviewModerationTagsTable)
    .set(update)
    .where(eq(reviewModerationTagsTable.id, id))
    .returning();
  if (!t) { res.status(404).json({ error: "Moderation tag not found" }); return; }
  res.json(formatModerationTag(t));
});

router.delete("/admin/moderation-tags/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await db
    .delete(reviewModerationTagsTable)
    .where(eq(reviewModerationTagsTable.id, id))
    .returning({ id: reviewModerationTagsTable.id });
  if (result.length === 0) { res.status(404).json({ error: "Moderation tag not found" }); return; }
  res.json({ success: true });
});

function formatPricing(p: typeof servicePricingTable.$inferSelect) {
  return {
    id: p.id, name: p.name, nameEn: p.nameEn, slides: p.slides,
    price: parseFloat(String(p.price)), deliveryDays: p.deliveryDays,
    revisions: p.revisions, features: p.features, featuresEn: p.featuresEn,
    isHighlight: p.isHighlight, isActive: p.isActive, sortOrder: p.sortOrder,
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/admin/pricing", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const plans = await db.select().from(servicePricingTable).orderBy(asc(servicePricingTable.sortOrder));
  res.json(plans.map(formatPricing));
});

router.put("/admin/pricing/:id", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  const { name, nameEn, slides, price, deliveryDays, revisions, features, featuresEn, isHighlight, isActive, sortOrder } = req.body;
  const [updated] = await db.update(servicePricingTable).set({
    name, nameEn, slides, price: String(price),
    deliveryDays: Number(deliveryDays), revisions,
    features: features ?? [], featuresEn: featuresEn ?? [],
    isHighlight: Boolean(isHighlight), isActive: Boolean(isActive),
    sortOrder: Number(sortOrder ?? 0),
  }).where(eq(servicePricingTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatPricing(updated));
});

// Public site settings — strict allowlist of keys that are safe to expose.
// Internal/operational keys (e.g. sepay_last_seen_tx_id checkpoint) MUST NOT
// leak through this endpoint.
const PUBLIC_SETTING_KEYS = new Set([
  "banner",
  "hero",
  "social",
  "footer",
  "contact",
  "seo",
  "homepage",
  "pricing_visibility",
  "announcement",
]);

router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(siteSettingsTable);
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    if (PUBLIC_SETTING_KEYS.has(row.key)) {
      result[row.key] = row.value;
    }
  }
  res.json(result);
});

// =====================================================================
// Template archive upload (.zip / .rar) — extracts pptx, renders preview
// =====================================================================
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const archiveUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const base = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 40);
      cb(null, `${Date.now()}_${base}${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".zip" || ext === ".rar") cb(null, true);
    else cb(new Error("Chỉ chấp nhận .zip hoặc .rar"));
  },
});

router.post(
  "/admin/templates/upload-archive",
  archiveUpload.single("file"),
  async (req, res): Promise<void> => {
    const ok = await requireAdminOrStaff(req, res, "manageTemplates");
    if (!ok) return;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Thiếu file" });
      return;
    }
    try {
      const result = await processTemplateArchive({
        archivePath: file.path,
        archiveName: file.originalname,
        uploadsDir,
      });
      res.json(result);
    } catch (err) {
      logger.error({ err, archive: file.originalname }, "Archive processing failed");
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : "Xử lý archive thất bại" });
    } finally {
      // Remove the uploaded archive after processing
      void fs.promises.unlink(file.path).catch(() => {});
    }
  },
);

// ---------------------------------------------------------------------------
// Process a single uploaded PPTX → thumbnail + per-slide preview images + PDF
// Used by the admin template form after uploading "File gốc".
// Body: { pptxUrl: string, maxSlides?: number }
// pptxUrl must point to a /api/uploads/* file already on disk.
// ---------------------------------------------------------------------------
router.post("/admin/templates/process-pptx", async (req, res): Promise<void> => {
  const ok = await requireAdminOrStaff(req, res, "manageTemplates");
  if (!ok) return;

  const { pptxUrl, maxSlides } = req.body ?? {};
  if (typeof pptxUrl !== "string" || !pptxUrl) {
    res.status(400).json({ error: "pptxUrl bắt buộc" });
    return;
  }
  if (!pptxUrl.startsWith("/api/uploads/")) {
    res.status(400).json({ error: "pptxUrl phải là /api/uploads/..." });
    return;
  }
  const relPath = pptxUrl.replace(/^\/api\/uploads\//, "").replace(/^\/+/, "");
  if (relPath.includes("..") || path.isAbsolute(relPath)) {
    res.status(400).json({ error: "pptxUrl không hợp lệ" });
    return;
  }
  const absPath = path.resolve(uploadsDir, relPath);
  const uploadsRoot = path.resolve(uploadsDir) + path.sep;
  if (!absPath.startsWith(uploadsRoot)) {
    res.status(400).json({ error: "pptxUrl ngoài vùng uploads" });
    return;
  }
  if (!fs.existsSync(absPath)) {
    res.status(404).json({ error: "File không tồn tại" });
    return;
  }
  if (!/\.pptx?$/i.test(absPath)) {
    res.status(400).json({ error: "Chỉ hỗ trợ .ppt/.pptx" });
    return;
  }

  try {
    const cap =
      typeof maxSlides === "number" && Number.isFinite(maxSlides) && maxSlides > 0
        ? Math.min(Math.floor(maxSlides), 100)
        : undefined;
    const result = await renderPptxAssets({
      pptxPath: absPath,
      uploadsDir,
      maxSlides: cap,
    });
    res.json(result);
  } catch (err) {
    logger.error({ err, pptxUrl }, "process-pptx failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Xử lý PPTX thất bại" });
  }
});

router.post("/admin/blog", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const { slug, titleVi, titleEn, excerptVi, excerptEn, contentVi, contentEn, coverImageUrl, author, tags } = req.body;
  const [post] = await db.insert(blogPostsTable).values({ slug, titleVi, titleEn, excerptVi, excerptEn, contentVi, contentEn, coverImageUrl, author, tags: tags ?? [] }).returning();
  res.status(201).json({ id: post.id, slug: post.slug, titleVi: post.titleVi, titleEn: post.titleEn, excerptVi: post.excerptVi, excerptEn: post.excerptEn, contentVi: post.contentVi, contentEn: post.contentEn, coverImageUrl: post.coverImageUrl, publishedAt: post.publishedAt.toISOString(), author: post.author, tags: post.tags });
});

export default router;
