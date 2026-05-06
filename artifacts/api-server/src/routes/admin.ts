import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, templatesTable, customRequestsTable, usersTable, vouchersTable, reviewsTable, blogPostsTable, categoriesTable } from "@workspace/db";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import { parseToken } from "./auth";

const router = Router();

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return false; }
  const payload = parseToken(authHeader.slice(7));
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return false; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return false; }
  return true;
}

router.get("/admin/stats", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;

  const [{ totalRevenue }] = await db.select({ totalRevenue: sql<number>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(eq(ordersTable.status, "paid"));
  const [{ totalOrders }] = await db.select({ totalOrders: sql<number>`count(*)::int` }).from(ordersTable);
  const [{ pendingCustomRequests }] = await db.select({ pendingCustomRequests: sql<number>`count(*)::int` }).from(customRequestsTable).where(eq(customRequestsTable.status, "pending"));

  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const [{ newCustomersThisMonth }] = await db.select({ newCustomersThisMonth: sql<number>`count(*)::int` }).from(usersTable).where(gte(usersTable.createdAt, monthAgo));

  const topTemplates = await db.select({
    id: templatesTable.id,
    title: templatesTable.titleVi,
    salesCount: templatesTable.salesCount,
    thumbnailUrl: templatesTable.thumbnailUrl,
  }).from(templatesTable).orderBy(desc(templatesTable.salesCount)).limit(5);

  const revenueByDay = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toISOString().split("T")[0],
      revenue: Math.floor(Math.random() * 5000000) + 500000,
      orders: Math.floor(Math.random() * 10) + 1,
    };
  });

  res.json({
    totalRevenue: parseFloat(String(totalRevenue)),
    totalOrders,
    pendingCustomRequests,
    newCustomersThisMonth,
    topTemplates: topTemplates.map(t => ({ ...t, revenue: t.salesCount * 99000 })),
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

  const { titleVi, titleEn, slug, price, thumbnailUrl, slideCount, aspectRatio, categoryId, style, isFree, isFeatured, descriptionVi, descriptionEn, features, tags, status } = req.body;
  const [template] = await db.insert(templatesTable).values({
    titleVi, titleEn, slug, price: String(price),
    thumbnailUrl, slideCount: Number(slideCount),
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
  const { titleVi, titleEn, slug, price, thumbnailUrl, slideCount, aspectRatio, categoryId, style, isFree, isFeatured, descriptionVi, descriptionEn, features, tags, status } = req.body;

  const [template] = await db.update(templatesTable).set({
    titleVi, titleEn, slug, price: String(price),
    thumbnailUrl, slideCount: Number(slideCount),
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
  const [order] = await db.update(ordersTable).set({ status: "paid", paidAt: new Date() }).where(eq(ordersTable.id, id)).returning();
  res.json({ id: order.id, status: order.status, total: parseFloat(String(order.total)), currency: order.currency, items: order.items, customerName: order.customerName, customerEmail: order.customerEmail, customerPhone: order.customerPhone, paymentMethod: order.paymentMethod, qrCode: order.qrCode, transferContent: order.transferContent, expiresAt: order.expiresAt?.toISOString() ?? null, paidAt: order.paidAt?.toISOString() ?? null, createdAt: order.createdAt.toISOString(), downloadLinks: [] });
});

router.get("/admin/custom-requests", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const requests = await db.select().from(customRequestsTable).orderBy(desc(customRequestsTable.createdAt));
  res.json(requests.map(r => ({
    id: r.id, requestId: r.requestId, status: r.status,
    slideType: r.slideType, slideCount: r.slideCount, deadline: r.deadline,
    style: r.style, language: r.language, budget: r.budget, notes: r.notes,
    quotedPrice: r.quotedPrice ? parseFloat(String(r.quotedPrice)) : null,
    customerName: r.customerName, customerEmail: r.customerEmail, customerPhone: r.customerPhone,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.patch("/admin/custom-requests/:id/status", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const { id } = req.params;
  const { status, quotedPrice, notes } = req.body;
  const updateData: any = { status };
  if (quotedPrice !== undefined) updateData.quotedPrice = String(quotedPrice);
  if (notes !== undefined) updateData.notes = notes;
  const [r] = await db.update(customRequestsTable).set(updateData).where(eq(customRequestsTable.requestId, id)).returning();
  res.json({ id: r.id, requestId: r.requestId, status: r.status, slideType: r.slideType, slideCount: r.slideCount, deadline: r.deadline, style: r.style, language: r.language, budget: r.budget, notes: r.notes, quotedPrice: r.quotedPrice ? parseFloat(String(r.quotedPrice)) : null, customerName: r.customerName, customerEmail: r.customerEmail, customerPhone: r.customerPhone, createdAt: r.createdAt.toISOString() });
});

router.get("/admin/users", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, avatarUrl: u.avatarUrl, createdAt: u.createdAt.toISOString() })));
});

router.get("/admin/vouchers", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const vouchers = await db.select().from(vouchersTable).orderBy(desc(vouchersTable.createdAt));
  res.json(vouchers.map(v => ({ id: v.id, code: v.code, discountType: v.discountType, discountValue: parseFloat(String(v.discountValue)), minOrderAmount: v.minOrderAmount ? parseFloat(String(v.minOrderAmount)) : null, expiresAt: v.expiresAt?.toISOString() ?? null, usageLimit: v.usageLimit, usageCount: v.usageCount, isActive: v.isActive, applicableCategory: v.applicableCategory, createdAt: v.createdAt.toISOString() })));
});

router.post("/admin/vouchers", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const { code, discountType, discountValue, minOrderAmount, expiresAt, usageLimit, applicableCategory } = req.body;
  const [v] = await db.insert(vouchersTable).values({ code: code.toUpperCase(), discountType, discountValue: String(discountValue), minOrderAmount: minOrderAmount ? String(minOrderAmount) : null, expiresAt: expiresAt ? new Date(expiresAt) : null, usageLimit: Number(usageLimit), applicableCategory: applicableCategory ?? null }).returning();
  res.status(201).json({ id: v.id, code: v.code, discountType: v.discountType, discountValue: parseFloat(String(v.discountValue)), minOrderAmount: v.minOrderAmount ? parseFloat(String(v.minOrderAmount)) : null, expiresAt: v.expiresAt?.toISOString() ?? null, usageLimit: v.usageLimit, usageCount: v.usageCount, isActive: v.isActive, applicableCategory: v.applicableCategory, createdAt: v.createdAt.toISOString() });
});

router.patch("/admin/reviews/:id/hide", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const id = parseInt(req.params.id, 10);
  await db.update(reviewsTable).set({ isHidden: true }).where(eq(reviewsTable.id, id));
  res.json({ success: true });
});

router.post("/admin/blog", async (req, res): Promise<void> => {
  const ok = await requireAdmin(req, res);
  if (!ok) return;
  const { slug, titleVi, titleEn, excerptVi, excerptEn, contentVi, contentEn, coverImageUrl, author, tags } = req.body;
  const [post] = await db.insert(blogPostsTable).values({ slug, titleVi, titleEn, excerptVi, excerptEn, contentVi, contentEn, coverImageUrl, author, tags: tags ?? [] }).returning();
  res.status(201).json({ id: post.id, slug: post.slug, titleVi: post.titleVi, titleEn: post.titleEn, excerptVi: post.excerptVi, excerptEn: post.excerptEn, contentVi: post.contentVi, contentEn: post.contentEn, coverImageUrl: post.coverImageUrl, publishedAt: post.publishedAt.toISOString(), author: post.author, tags: post.tags });
});

export default router;
