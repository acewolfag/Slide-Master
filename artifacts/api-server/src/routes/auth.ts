import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, gt, isNull } from "drizzle-orm";
import crypto from "crypto";
import { validateAll, validateCustomerName, validateEmail, validateText } from "../lib/validators";

const router = Router();

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + process.env.SESSION_SECRET).digest("hex");
}

/**
 * Validate avatar URL: only accept relative paths under /api/uploads/* (files
 * uploaded through our own upload endpoint) or HTTPS URLs from a small
 * allowlist of known image hosts.
 *
 * Configurable via env: AVATAR_URL_ALLOWED_HOSTS=cdn.example.com,…
 */
function isAllowedAvatarUrl(url: string): boolean {
  if (typeof url !== "string" || url.length === 0) return false;
  if (url.length > 500) return false;
  // Allow our own uploads
  if (url.startsWith("/api/uploads/") && !url.includes("..")) return true;
  // Allow HTTPS URLs from allowlist
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const allowed = (process.env.AVATAR_URL_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const defaults = [
    "images.unsplash.com",
    "lh3.googleusercontent.com",
    "avatars.githubusercontent.com",
  ];
  const hosts = new Set([...defaults, ...allowed]);
  return hosts.has(parsed.hostname.toLowerCase());
}

/** Timing-safe comparison of two hex hashes. */
export function constantTimeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function getSigningSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not configured");
  return secret;
}

function signPayload(b64Payload: string): string {
  return crypto
    .createHmac("sha256", getSigningSecret())
    .update(b64Payload)
    .digest("hex");
}

/**
 * Issue an auth token with format `<base64url-payload>.<hex-hmac>`.
 * Payload is `{userId, exp}` JSON; HMAC is over the base64 payload using
 * SESSION_SECRET. Tokens issued before this format (no dot) are rejected,
 * so all existing sessions need to re-login after deploy.
 */
function generateToken(userId: number): string {
  const payload = JSON.stringify({ userId, exp: Date.now() + 7 * 24 * 3600 * 1000 });
  const b64 = Buffer.from(payload).toString("base64url");
  const sig = signPayload(b64);
  return `${b64}.${sig}`;
}

export function parseToken(token: string): { userId: number } | null {
  try {
    const dotIdx = token.indexOf(".");
    if (dotIdx <= 0 || dotIdx === token.length - 1) return null;
    const b64 = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    const expected = signPayload(b64);
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString());
    if (typeof payload?.userId !== "number" || typeof payload?.exp !== "number") return null;
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
  const v = validateAll(
    validateCustomerName(name),
    validateEmail(email),
    validateText(password, { maxLength: 200, fieldName: "Mật khẩu" }),
  );
  if (!v.ok) { res.status(400).json({ error: v.error }); return; }
  if (typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Mật khẩu tối thiểu 6 ký tự" });
    return;
  }

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
  if (!user || !constantTimeEqual(user.passwordHash, hashPassword(password))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Track last login time
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  const token = generateToken(user.id);
  res.json({ user: formatUser(user), token });
});

// Public reset-password endpoint: caller submits token + newPassword.
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, newPassword } = req.body ?? {};
  if (!token || typeof token !== "string" || !newPassword || typeof newPassword !== "string") {
    res.status(400).json({ error: "Thiếu token hoặc mật khẩu mới" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "Mật khẩu phải tối thiểu 6 ký tự" });
    return;
  }
  const now = new Date();
  // Timing-safe lookup: fetch all candidate (unused, unexpired) tokens and
  // compare each in constant time. Avoids the small timing oracle of a
  // direct DB equality check on the token field. The candidate set should be
  // small in practice (only outstanding reset requests).
  const candidates = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        gt(passwordResetTokensTable.expiresAt, now),
        isNull(passwordResetTokensTable.usedAt),
      ),
    );
  const inputBuf = Buffer.from(token);
  let matched: (typeof candidates)[number] | null = null;
  for (const row of candidates) {
    const dbBuf = Buffer.from(row.token);
    if (dbBuf.length !== inputBuf.length) continue;
    if (crypto.timingSafeEqual(dbBuf, inputBuf)) {
      matched = row;
      // do not break — keep loop time roughly proportional to candidate count
    }
  }
  if (!matched) {
    res.status(400).json({ error: "Token không hợp lệ hoặc đã hết hạn" });
    return;
  }
  await db
    .update(usersTable)
    .set({ passwordHash: hashPassword(newPassword) })
    .where(eq(usersTable.id, matched.userId));
  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: now })
    .where(eq(passwordResetTokensTable.id, matched.id));
  res.json({ ok: true });
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
  if (avatarUrl !== undefined) {
    if (avatarUrl === null || avatarUrl === "") {
      updateData.avatarUrl = null;
    } else if (typeof avatarUrl === "string" && isAllowedAvatarUrl(avatarUrl)) {
      updateData.avatarUrl = avatarUrl;
    } else {
      res.status(400).json({ error: "avatarUrl không hợp lệ. Chỉ chấp nhận /api/uploads/... hoặc HTTPS từ host được cấp phép." });
      return;
    }
  }
  if (newPassword && currentPassword) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user || !constantTimeEqual(user.passwordHash, hashPassword(currentPassword))) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }
    updateData.passwordHash = hashPassword(newPassword);
  }

  const [updated] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, payload.userId)).returning();
  res.json(formatUser(updated));
});

export default router;
