import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + process.env.SESSION_SECRET).digest("hex");
}

function generateToken(userId: number): string {
  const payload = JSON.stringify({ userId, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  return Buffer.from(payload).toString("base64");
}

export function parseToken(token: string): { userId: number } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (payload.exp < Date.now()) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) { res.status(400).json({ error: "Missing required fields" }); return; }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) { res.status(400).json({ error: "Email already registered" }); return; }

  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash: hashPassword(password),
    role: "customer",
  }).returning();

  const token = generateToken(user.id);
  res.status(201).json({ user: formatUser(user), token });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "Missing required fields" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = generateToken(user.id);
  res.json({ user: formatUser(user), token });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  res.json({ success: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }

  const token = authHeader.slice(7);
  const payload = parseToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid or expired token" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) { res.status(401).json({ error: "User not found" }); return; }

  res.json(formatUser(user));
});

router.patch("/auth/profile", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }

  const token = authHeader.slice(7);
  const payload = parseToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid or expired token" }); return; }

  const { name, avatarUrl, currentPassword, newPassword } = req.body;
  const updateData: Partial<typeof usersTable.$inferInsert> = {};

  if (name) updateData.name = name;
  if (avatarUrl) updateData.avatarUrl = avatarUrl;
  if (newPassword && currentPassword) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user || user.passwordHash !== hashPassword(currentPassword)) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }
    updateData.passwordHash = hashPassword(newPassword);
  }

  const [updated] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, payload.userId)).returning();
  res.json(formatUser(updated));
});

export default router;
