import { Router } from "express";
import { db } from "@workspace/db";
import { blogPostsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

function formatPost(p: typeof blogPostsTable.$inferSelect) {
  return {
    id: p.id,
    slug: p.slug,
    titleVi: p.titleVi,
    titleEn: p.titleEn,
    excerptVi: p.excerptVi,
    excerptEn: p.excerptEn,
    contentVi: p.contentVi,
    contentEn: p.contentEn,
    coverImageUrl: p.coverImageUrl,
    publishedAt: p.publishedAt.toISOString(),
    author: p.author,
    tags: p.tags,
  };
}

router.get("/blog", async (req, res): Promise<void> => {
  const { page = "1", limit = "10" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const posts = await db.select().from(blogPostsTable).orderBy(desc(blogPostsTable.publishedAt)).limit(limitNum).offset((pageNum - 1) * limitNum);
  res.json(posts.map(formatPost));
});

router.get("/blog/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.slug, slug));
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatPost(post));
});

export default router;
