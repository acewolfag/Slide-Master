import { pgTable, text, serial, integer, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const customRequestStatusEnum = pgEnum("custom_request_status", [
  "pending",
  "quoted",
  "deposit-paid",
  "in-progress",
  "review",
  "final-payment",
  "delivered",
]);

export const customRequestsTable = pgTable("custom_requests", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  userId: integer("user_id").references(() => usersTable.id),
  status: customRequestStatusEnum("status").notNull().default("pending"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  company: text("company"),
  slideType: text("slide_type").notNull(),
  targetAudience: text("target_audience"),
  objective: text("objective"),
  slideCount: integer("slide_count").notNull(),
  style: text("style"),
  colorPalette: text("color_palette"),
  aspectRatio: text("aspect_ratio").notNull().default("16:9"),
  language: text("language").notNull().default("vi"),
  deadline: text("deadline").notNull(),
  budget: text("budget"),
  notes: text("notes"),
  quotedPrice: numeric("quoted_price", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCustomRequestSchema = createInsertSchema(customRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomRequest = z.infer<typeof insertCustomRequestSchema>;
export type CustomRequest = typeof customRequestsTable.$inferSelect;
