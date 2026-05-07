import { Router } from "express";
import { db } from "@workspace/db";
import { servicePricingTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";

const router = Router();

router.get("/pricing", async (_req, res): Promise<void> => {
  const plans = await db.select().from(servicePricingTable)
    .where(eq(servicePricingTable.isActive, true))
    .orderBy(asc(servicePricingTable.sortOrder));
  res.json(plans.map(p => ({
    id: p.id, name: p.name, nameEn: p.nameEn, slides: p.slides,
    price: parseFloat(String(p.price)), deliveryDays: p.deliveryDays,
    revisions: p.revisions, features: p.features, featuresEn: p.featuresEn,
    isHighlight: p.isHighlight,
  })));
});

export default router;
