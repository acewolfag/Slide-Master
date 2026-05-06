import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, templatesTable } from "@workspace/db";
import { sql, ilike, or } from "drizzle-orm";

const router = Router();

router.get("/categories", async (req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.nameVi);
  res.json(categories.map(c => ({
    id: c.id,
    nameVi: c.nameVi,
    nameEn: c.nameEn,
    slug: c.slug,
    icon: c.icon,
    imageUrl: c.imageUrl,
    templateCount: c.templateCount,
  })));
});

router.get("/tags", async (req, res): Promise<void> => {
  const rows = await db
    .select({ tag: sql<string>`unnest(${templatesTable.tags})` })
    .from(templatesTable);

  const tagCount: Record<string, number> = {};
  for (const row of rows) {
    tagCount[row.tag] = (tagCount[row.tag] ?? 0) + 1;
  }

  const tags = Object.entries(tagCount)
    .map(([name, count], idx) => ({ id: idx + 1, name, templateCount: count }))
    .sort((a, b) => b.templateCount - a.templateCount)
    .slice(0, 50);

  res.json(tags);
});

router.get("/search/suggestions", async (req, res): Promise<void> => {
  const { q } = req.query as { q: string };
  if (!q || q.length < 2) { res.json([]); return; }

  const templates = await db
    .select({
      id: templatesTable.id,
      titleVi: templatesTable.titleVi,
      titleEn: templatesTable.titleEn,
      slug: templatesTable.slug,
      thumbnailUrl: templatesTable.thumbnailUrl,
    })
    .from(templatesTable)
    .where(or(
      ilike(templatesTable.titleVi, `%${q}%`),
      ilike(templatesTable.titleEn, `%${q}%`),
    )!)
    .limit(8);

  res.json(templates.map(t => ({
    id: t.id,
    title: t.titleVi,
    slug: t.slug,
    thumbnailUrl: t.thumbnailUrl,
    type: "template",
  })));
});

export default router;
