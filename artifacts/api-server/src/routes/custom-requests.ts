import { Router } from "express";
import { db } from "@workspace/db";
import { customRequestsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { parseToken } from "./auth";

const router = Router();

function formatRequest(r: typeof customRequestsTable.$inferSelect) {
  return {
    id: r.id,
    requestId: r.requestId,
    status: r.status,
    slideType: r.slideType,
    slideCount: r.slideCount,
    deadline: r.deadline,
    style: r.style,
    language: r.language,
    budget: r.budget,
    notes: r.notes,
    quotedPrice: r.quotedPrice ? parseFloat(String(r.quotedPrice)) : null,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    customerPhone: r.customerPhone,
    createdAt: r.createdAt.toISOString(),
  };
}

function generateRequestId(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `CUSTOM-${year}-${seq}`;
}

router.get("/custom-requests", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.json([]); return; }
  const payload = parseToken(authHeader.slice(7));
  if (!payload) { res.json([]); return; }

  const requests = await db.select().from(customRequestsTable)
    .where(eq(customRequestsTable.userId, payload.userId))
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

  let userId: number | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const payload = parseToken(authHeader.slice(7));
    if (payload) userId = payload.userId;
  }

  const [request] = await db.insert(customRequestsTable).values({
    requestId: generateRequestId(),
    userId: userId ?? null,
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
    attachments: Array.isArray(attachments) ? attachments : [],
  }).returning();

  res.status(201).json(formatRequest(request));
});

router.get("/custom-requests/:id", async (req, res): Promise<void> => {
  const id = req.params.id;
  const [request] = await db.select().from(customRequestsTable).where(eq(customRequestsTable.requestId, id));
  if (!request) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatRequest(request));
});

export default router;
