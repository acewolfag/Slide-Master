import { pgTable, text, serial, integer, timestamp, boolean, numeric, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "failed", "refunded"]);

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  status: orderStatusEnum("status").notNull().default("pending"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("VND"),
  items: jsonb("items").notNull(),
  paymentMethod: text("payment_method").notNull().default("VietQR"),
  qrCode: text("qr_code"),
  transferContent: text("transfer_content"),
  needVatInvoice: boolean("need_vat_invoice").notNull().default(false),
  companyName: text("company_name"),
  taxCode: text("tax_code"),
  voucherCode: text("voucher_code"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  sepayTransactionId: text("sepay_transaction_id").unique(),
  webhookReceivedAt: timestamp("webhook_received_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
