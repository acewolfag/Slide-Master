import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

/**
 * Escape HTML special characters for safe interpolation in email bodies.
 */
export function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let _transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (_transporter !== undefined) return _transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    _transporter = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = (process.env.SMTP_SECURE ?? "false").toLowerCase() === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
  return _transporter;
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(args: SendEmailArgs): Promise<{ sent: boolean; reason?: string }> {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: "SMTP not configured" };
  const from = process.env.SMTP_FROM ?? "no-reply@2grils.com";
  try {
    await transporter.sendMail({ from, to: args.to, subject: args.subject, html: args.html, text: args.text });
    logger.info({ to: args.to, subject: args.subject }, "email sent");
    return { sent: true };
  } catch (err) {
    logger.error({ err, to: args.to }, "email send failed");
    return { sent: false, reason: err instanceof Error ? err.message : "send failed" };
  }
}
