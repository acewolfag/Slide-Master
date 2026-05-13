// SePay integration helpers.
// Public docs: https://docs.sepay.vn

import { db } from "@workspace/db";
import { ordersTable, siteSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { markOrderPaid } from "./payments";
import { logger } from "./logger";

export interface SepayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  code: string | null;
  content: string;
  transferType: "in" | "out";
  transferAmount: number;
  accumulated: number;
  subAccount: string | null;
  referenceCode: string;
  description: string;
}

export interface SepayUserApiTransaction {
  id: string;
  bank_brand_name?: string;
  account_number?: string;
  transaction_date: string;
  amount_out: string;
  amount_in: string;
  accumulated?: string;
  transaction_content: string;
  reference_number?: string;
  code?: string | null;
  sub_account?: string | null;
  bank_account_id?: string;
}

export interface SepayConfig {
  apiKey: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export function readSepayConfig(): SepayConfig | null {
  const apiKey = process.env.SEPAY_API_KEY;
  const bankCode = process.env.SEPAY_BANK_CODE;
  const accountNumber = process.env.SEPAY_ACCOUNT_NUMBER;
  const accountName = process.env.SEPAY_ACCOUNT_NAME;
  if (!apiKey || !bankCode || !accountNumber || !accountName) return null;
  return { apiKey, bankCode, accountNumber, accountName };
}

/**
 * SePay User API access token — created at https://my.sepay.vn/access_tokens
 * Different from SEPAY_API_KEY (which is the webhook API key).
 * Falls back to SEPAY_API_KEY if not set (works only if you generated a single
 * key with both scopes).
 */
export function readSepayUserApiToken(): string | null {
  return (
    process.env.SEPAY_USER_API_TOKEN?.trim() ||
    process.env.SEPAY_API_KEY?.trim() ||
    null
  );
}

export function buildSepayQrUrl(args: {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  transferContent: string;
  template?: "compact" | "compact2" | "qronly" | "print";
}): string {
  const params = new URLSearchParams({
    bank: args.bankCode,
    acc: args.accountNumber,
    template: args.template ?? "compact",
    amount: String(Math.round(args.amount)),
    des: args.transferContent,
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

export function verifySepayApiKey(authHeader: string | undefined, expected: string): boolean {
  if (!authHeader) return false;
  const match = /^Apikey\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return false;
  const provided = match[1].trim();
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// Match order codes like "2GRILS ORD239693D9C4" — 6 digits + 4 hex (uppercase
// from generateOrderCode). Must include A-F because the hex random suffix may
// contain letters (without /i + A-F here, SePay matching breaks for ~85% of orders).
const ORDER_CODE_REGEX = /(2GRILS\s*ORD[0-9A-F]+)/i;

export function extractOrderCode(payload: SepayWebhookPayload): string | null {
  const candidates = [payload.code, payload.content, payload.description].filter(
    (s): s is string => typeof s === "string" && s.length > 0,
  );
  for (const candidate of candidates) {
    const match = ORDER_CODE_REGEX.exec(candidate);
    if (match) return match[1].toUpperCase().replace(/\s+/g, " ").trim();
  }
  return null;
}

function extractOrderCodeFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = ORDER_CODE_REGEX.exec(text);
  return match ? match[1].toUpperCase().replace(/\s+/g, " ").trim() : null;
}

// =====================================================================
// Shared processor used by both webhook and polling worker.
// =====================================================================

export type ProcessOutcome =
  | { kind: "paid"; orderId: number; alreadyPaid: boolean }
  | { kind: "ignored"; reason: string }
  | { kind: "error"; reason: string };

interface NormalizedTransfer {
  sepayTxId: string;
  orderCode: string | null;
  amountIn: number;
  isIncoming: boolean;
  receivedAt: Date;
}

function normalizeFromWebhook(p: SepayWebhookPayload): NormalizedTransfer {
  return {
    sepayTxId: String(p.id),
    orderCode: extractOrderCode(p),
    amountIn: Number(p.transferAmount) || 0,
    isIncoming: p.transferType === "in",
    receivedAt: new Date(),
  };
}

function normalizeFromUserApi(t: SepayUserApiTransaction): NormalizedTransfer {
  const amountIn = parseFloat(t.amount_in ?? "0") || 0;
  const isIncoming = amountIn > 0;
  const orderCode =
    extractOrderCodeFromText(t.transaction_content) ??
    extractOrderCodeFromText(t.code ?? null) ??
    extractOrderCodeFromText(t.reference_number ?? null);
  const parsedDate = new Date(t.transaction_date);
  return {
    sepayTxId: String(t.id),
    orderCode,
    amountIn,
    isIncoming,
    receivedAt: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
  };
}

async function processNormalized(
  n: NormalizedTransfer,
): Promise<ProcessOutcome> {
  if (!n.isIncoming) {
    return { kind: "ignored", reason: "non-incoming" };
  }
  if (!n.orderCode) {
    return { kind: "ignored", reason: "no-order-code" };
  }

  const [byTxId] = await db
    .select({ id: ordersTable.id, status: ordersTable.status })
    .from(ordersTable)
    .where(eq(ordersTable.sepayTransactionId, n.sepayTxId));
  if (byTxId) {
    return { kind: "paid", orderId: byTxId.id, alreadyPaid: true };
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.transferContent, n.orderCode));
  if (!order) {
    return { kind: "ignored", reason: "no-matching-order" };
  }

  const expectedAmount = parseFloat(String(order.total));
  if (Math.round(n.amountIn) < Math.round(expectedAmount)) {
    return { kind: "ignored", reason: "insufficient-amount" };
  }

  const result = await markOrderPaid(order.id, {
    source: "sepay-webhook",
    sepayTransactionId: n.sepayTxId,
    webhookReceivedAt: n.receivedAt,
  });

  if (!result) return { kind: "error", reason: "order-vanished" };
  return { kind: "paid", orderId: result.order.id, alreadyPaid: result.alreadyPaid };
}

export function processSepayWebhook(p: SepayWebhookPayload): Promise<ProcessOutcome> {
  return processNormalized(normalizeFromWebhook(p));
}

export function processSepayUserApi(t: SepayUserApiTransaction): Promise<ProcessOutcome> {
  return processNormalized(normalizeFromUserApi(t));
}

// =====================================================================
// SePay User API fetcher
// =====================================================================

const SEPAY_USER_API_URL = "https://my.sepay.vn/userapi/transactions/list";

export async function fetchSepayTransactions(opts: {
  apiKey: string;
  accountNumber?: string;
  sinceId?: string | null;
  limit?: number;
}): Promise<SepayUserApiTransaction[]> {
  const params = new URLSearchParams();
  if (opts.accountNumber) params.set("account_number", opts.accountNumber);
  params.set("limit", String(opts.limit ?? 20));
  if (opts.sinceId) params.set("since_id", opts.sinceId);

  const url = `${SEPAY_USER_API_URL}?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error(
        `SePay API 401: token không hợp lệ. ` +
          `Kiểm tra SEPAY_USER_API_TOKEN (tạo tại https://my.sepay.vn/access_tokens). ` +
          `Đây là token KHÁC với SEPAY_API_KEY của webhook.`,
      );
    }
    throw new Error(`SePay API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { status?: number; transactions?: SepayUserApiTransaction[] };
  return json.transactions ?? [];
}

// =====================================================================
// Checkpoint persistence (site_settings)
// =====================================================================

const CHECKPOINT_KEY = "sepay_last_seen_tx_id";

export async function readLastSeenTxId(): Promise<string | null> {
  const [row] = await db
    .select()
    .from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, CHECKPOINT_KEY));
  if (!row) return null;
  const v = row.value as unknown;
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "id" in v && typeof (v as { id?: unknown }).id === "string") {
    return (v as { id: string }).id;
  }
  return null;
}

export async function writeLastSeenTxId(id: string): Promise<void> {
  await db
    .insert(siteSettingsTable)
    .values({ key: CHECKPOINT_KEY, value: id })
    .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value: id } });
}

// =====================================================================
// Poller
// =====================================================================

export interface PollerHandle {
  stop: () => void;
}

export interface PollerOptions {
  intervalMs?: number;
  limit?: number;
}

export function startSepayPoller(opts: PollerOptions = {}): PollerHandle | null {
  const config = readSepayConfig();
  if (!config) {
    logger.warn("SePay polling disabled — SEPAY_API_KEY/SEPAY_ACCOUNT_NUMBER not set");
    return null;
  }
  const userApiToken = readSepayUserApiToken();
  if (!userApiToken) {
    logger.warn("SePay polling disabled — SEPAY_USER_API_TOKEN not set");
    return null;
  }
  const interval = opts.intervalMs ?? Number(process.env.SEPAY_POLL_INTERVAL_MS ?? 30000);
  const limit = opts.limit ?? Number(process.env.SEPAY_POLL_LIMIT ?? 20);

  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let consecutiveFailures = 0;
  const MAX_FAILURES_BEFORE_ALERT = 5;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const sinceId = await readLastSeenTxId();
      const txs = await fetchSepayTransactions({
        apiKey: userApiToken,
        accountNumber: config.accountNumber,
        sinceId,
        limit,
      });

      if (txs.length === 0) {
        consecutiveFailures = 0;
        return;
      }

      // SePay returns newest first; process oldest first so the checkpoint
      // advances monotonically.
      const ordered = [...txs].sort((a, b) => Number(a.id) - Number(b.id));

      // Advance the checkpoint per-transaction so a mid-batch failure can't
      // cause the whole batch to be re-processed.
      for (const tx of ordered) {
        try {
          const outcome = await processSepayUserApi(tx);
          if (outcome.kind === "paid" && !outcome.alreadyPaid) {
            logger.info({ sepayTxId: tx.id, orderId: outcome.orderId }, "SePay poll: order auto-paid");
          } else if (outcome.kind === "error") {
            logger.error({ sepayTxId: tx.id, reason: outcome.reason }, "SePay poll: error");
          }
          // Advance checkpoint only on successful processing or definitive ignore.
          await writeLastSeenTxId(String(tx.id)).catch((err) => {
            logger.error({ err, sepayTxId: tx.id }, "Failed to write last_seen_tx_id checkpoint");
          });
        } catch (err) {
          logger.error({ err, sepayTxId: tx.id }, "SePay poll: tx processing threw");
          // Don't advance checkpoint — this tx will be retried next tick.
          break;
        }
      }
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALERT) {
        logger.fatal(
          { err, consecutiveFailures },
          `SePay poll has failed ${consecutiveFailures} consecutive ticks — payments are not being auto-detected`,
        );
      } else {
        logger.error({ err, consecutiveFailures }, "SePay poll tick failed");
      }
    } finally {
      running = false;
    }
  };

  setTimeout(() => void tick(), 2000);
  timer = setInterval(() => void tick(), interval);

  logger.info({ intervalMs: interval, accountNumber: config.accountNumber }, "SePay poller started");

  return {
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
    },
  };
}
