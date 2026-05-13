import { Router } from "express";
import {
  verifySepayApiKey,
  processSepayWebhook,
  type SepayWebhookPayload,
} from "../lib/sepay";
import { logger } from "../lib/logger";

const router = Router();

router.post("/webhooks/sepay", async (req, res): Promise<void> => {
  const expected = process.env.SEPAY_API_KEY;
  if (!expected) {
    logger.error("SEPAY_API_KEY not set - refusing webhook");
    res.status(503).json({ error: "Payment webhook not configured" });
    return;
  }

  if (!verifySepayApiKey(req.headers.authorization, expected)) {
    logger.warn({ ip: req.ip }, "SePay webhook auth failed");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = req.body as SepayWebhookPayload;
  if (!payload || typeof payload.id !== "number") {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const outcome = await processSepayWebhook(payload);

  if (outcome.kind === "ignored") {
    logger.info({ id: payload.id, reason: outcome.reason }, "SePay webhook ignored");
    res.status(200).json({ ok: true, ignored: outcome.reason });
    return;
  }

  if (outcome.kind === "error") {
    logger.error({ id: payload.id, reason: outcome.reason }, "SePay webhook error");
    res.status(500).json({ error: outcome.reason });
    return;
  }

  res.status(200).json({
    ok: true,
    orderId: outcome.orderId,
    idempotent: outcome.alreadyPaid,
  });
});

export default router;
