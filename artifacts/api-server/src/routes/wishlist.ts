import { Router } from "express";
import { db } from "@workspace/db";
import { wishlistTable, templatesTable, categoriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { parseToken } from "./auth";

const router = Router();

router.get("/wishlist", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.json([]); return; }
  const payload = parseToken(authHeader.slice(7));
  if (!payload) { res.json([]); return; }

  const items = await db.select().from(wishlistTable).where(eq(wishlistTable.userId, payload.userId));
  const templates = await Promise.all(items.map(async (w) => {
    const [t] = await db.select().from(templatesTable).where(eq(templatesTable.id, w.templateId));
    if (!t) return null;
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
  res.json(templates.filter(Boolean));
});

router.post("/wishlist/:templateId", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const payload = parseToken(authHeader.slice(7));
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

  const templateId = parseInt(req.params.templateId, 10);
  await db.insert(wishlistTable).values({ userId: payload.userId, templateId }).onConflictDoNothing();
  res.json({ success: true });
});

router.delete("/wishlist/:templateId", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const payload = parseToken(authHeader.slice(7));
  if (!payload) { res.status(401).json({ error: "Unauthorized" }); return; }

  const templateId = parseInt(req.params.templateId, 10);
  await db.delete(wishlistTable).where(and(eq(wishlistTable.userId, payload.userId), eq(wishlistTable.templateId, templateId)));
  res.json({ success: true });
});

export default router;
