import { Router } from "express";
import { db } from "@workspace/db";
import { templatesTable, categoriesTable, reviewsTable } from "@workspace/db";
import { eq, like, and, gte, lte, desc, asc, sql, ilike, or } from "drizzle-orm";

const router = Router();

router.get("/templates/featured", async (req, res): Promise<void> => {
  const templates = await db
    .select()
    .from(templatesTable)
    .where(and(eq(templatesTable.isFeatured, true), eq(templatesTable.status, "active")))
    .orderBy(desc(templatesTable.createdAt))
    .limit(8);

  const withCategory = await Promise.all(templates.map(async (t) => {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, t.categoryId));
    return formatTemplate(t, cat?.nameVi ?? "");
  }));
  res.json(withCategory);
});

router.get("/templates/best-sellers", async (req, res): Promise<void> => {
  const templates = await db
    .select()
    .from(templatesTable)
    .where(and(eq(templatesTable.isBestSeller, true), eq(templatesTable.status, "active")))
    .orderBy(desc(templatesTable.salesCount))
    .limit(8);

  const withCategory = await Promise.all(templates.map(async (t) => {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, t.categoryId));
    return formatTemplate(t, cat?.nameVi ?? "");
  }));
  res.json(withCategory);
});

router.get("/templates/latest", async (req, res): Promise<void> => {
  const templates = await db
    .select()
    .from(templatesTable)
    .where(eq(templatesTable.status, "active"))
    .orderBy(desc(templatesTable.createdAt))
    .limit(8);

  const withCategory = await Promise.all(templates.map(async (t) => {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, t.categoryId));
    return formatTemplate(t, cat?.nameVi ?? "");
  }));
  res.json(withCategory);
});

router.get("/templates/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, id));
  if (!template) { res.status(404).json({ error: "Not found" }); return; }

  const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, template.categoryId));

  const ratingRows = await db
    .select({ stars: reviewsTable.rating, count: sql<number>`count(*)::int` })
    .from(reviewsTable)
    .where(and(eq(reviewsTable.templateId, id), eq(reviewsTable.isHidden, false)))
    .groupBy(reviewsTable.rating);

  const ratingDistribution = [5, 4, 3, 2, 1].map(s => ({
    stars: s,
    count: ratingRows.find(r => r.stars === s)?.count ?? 0,
  }));

  res.json({
    ...formatTemplate(template, cat?.nameVi ?? ""),
    descriptionVi: template.descriptionVi ?? "",
    descriptionEn: template.descriptionEn ?? "",
    features: template.features,
    compatibleSoftware: template.compatibleSoftware,
    ratingDistribution,
  });
});

router.get("/templates/:id/related", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, id));
  if (!template) { res.status(404).json({ error: "Not found" }); return; }

  const related = await db
    .select()
    .from(templatesTable)
    .where(and(
      eq(templatesTable.categoryId, template.categoryId),
      eq(templatesTable.status, "active"),
      sql`${templatesTable.id} != ${id}`,
    ))
    .limit(6);

  const withCategory = await Promise.all(related.map(async (t) => {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, t.categoryId));
    return formatTemplate(t, cat?.nameVi ?? "");
  }));
  res.json(withCategory);
});

router.get("/templates/:id/reviews", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(and(eq(reviewsTable.templateId, id), eq(reviewsTable.isHidden, false)))
    .orderBy(desc(reviewsTable.createdAt));

  const total = reviews.length;
  const avgRating = total > 0
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / total
    : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map(s => ({
    stars: s,
    count: reviews.filter(r => r.stars === s || r.rating === s).length,
  }));

  res.json({
    items: reviews.map(r => ({
      id: r.id,
      templateId: r.templateId,
      authorName: r.authorName,
      rating: r.rating,
      comment: r.comment,
      imageUrl: r.imageUrl,
      isVerifiedPurchase: r.isVerifiedPurchase,
      isHidden: r.isHidden,
      createdAt: r.createdAt.toISOString(),
    })),
    avgRating: Math.round(avgRating * 10) / 10,
    total,
    ratingDistribution,
  });
});

router.post("/templates/:id/reviews", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { rating, comment, imageUrl } = req.body;
  if (!rating || !comment) { res.status(400).json({ error: "Rating and comment are required" }); return; }

  const [review] = await db.insert(reviewsTable).values({
    templateId: id,
    authorName: "Khách hàng",
    rating: Number(rating),
    comment,
    imageUrl: imageUrl ?? null,
    isVerifiedPurchase: false,
    isHidden: false,
  }).returning();

  res.status(201).json({
    id: review.id,
    templateId: review.templateId,
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    imageUrl: review.imageUrl,
    isVerifiedPurchase: review.isVerifiedPurchase,
    isHidden: review.isHidden,
    createdAt: review.createdAt.toISOString(),
  });
});

router.get("/templates", async (req, res): Promise<void> => {
  const { category, style, minPrice, maxPrice, tag, sort, search, isFree, page = "1", limit = "20" } = req.query as Record<string, string>;

  const conditions = [eq(templatesTable.status, "active")];

  if (category) {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, category));
    if (cat) conditions.push(eq(templatesTable.categoryId, cat.id));
  }
  if (style) conditions.push(eq(templatesTable.style, style));
  if (minPrice) conditions.push(gte(templatesTable.price, minPrice));
  if (maxPrice) conditions.push(lte(templatesTable.price, maxPrice));
  if (isFree === "true") conditions.push(eq(templatesTable.isFree, true));
  if (search) {
    conditions.push(or(
      ilike(templatesTable.titleVi, `%${search}%`),
      ilike(templatesTable.titleEn, `%${search}%`),
    )!);
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let orderBy;
  switch (sort) {
    case "best-seller": orderBy = desc(templatesTable.salesCount); break;
    case "price-asc": orderBy = asc(templatesTable.price); break;
    case "price-desc": orderBy = desc(templatesTable.price); break;
    case "top-rated": orderBy = desc(templatesTable.avgRating); break;
    default: orderBy = desc(templatesTable.createdAt);
  }

  const whereClause = and(...conditions);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(templatesTable).where(whereClause);
  const templates = await db.select().from(templatesTable).where(whereClause).orderBy(orderBy).limit(limitNum).offset(offset);

  const withCategory = await Promise.all(templates.map(async (t) => {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, t.categoryId));
    return formatTemplate(t, cat?.nameVi ?? "");
  }));

  res.json({ items: withCategory, total: count, page: pageNum, limit: limitNum });
});

function formatTemplate(t: typeof templatesTable.$inferSelect, categoryName: string) {
  return {
    id: t.id,
    titleVi: t.titleVi,
    titleEn: t.titleEn,
    slug: t.slug,
    price: parseFloat(String(t.price)),
    isFree: t.isFree,
    thumbnailUrl: t.thumbnailUrl,
    previewImages: t.previewImages,
    slideCount: t.slideCount,
    aspectRatio: t.aspectRatio,
    categoryId: t.categoryId,
    categoryName,
    style: t.style,
    tags: t.tags,
    isFeatured: t.isFeatured,
    isBestSeller: t.isBestSeller,
    avgRating: parseFloat(String(t.avgRating)),
    reviewCount: t.reviewCount,
    salesCount: t.salesCount,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  };
}

export default router;
