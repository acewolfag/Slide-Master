import { pgTable, text, serial, integer, timestamp, numeric, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const customRequestStatusEnum = pgEnum("custom_request_status", [
  "pending",
  "quoted",
  "deposit-paid",
  "in-progress",
  "review",
  "finalizing",
  "final-payment",
  "delivered",
]);

export type CustomRequestFile = { name: string; url: string; type: string; size?: number };

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
  attachments: jsonb("attachments").$type<CustomRequestFile[]>().default([]),
  quotedPrice: numeric("quoted_price", { precision: 12, scale: 2 }),
  depositAmount: numeric("deposit_amount", { precision: 12, scale: 2 }),
  finalAmount: numeric("final_amount", { precision: 12, scale: 2 }),
  depositOrderId: integer("deposit_order_id"),
  finalOrderId: integer("final_order_id"),
  depositPaidAt: timestamp("deposit_paid_at", { withTimezone: true }),
  finalPaidAt: timestamp("final_paid_at", { withTimezone: true }),
  quoteMessage: text("quote_message"),
  customerFeedback: text("customer_feedback"),
  demoFiles: jsonb("demo_files").$type<CustomRequestFile[]>().default([]),
  finalFiles: jsonb("final_files").$type<CustomRequestFile[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCustomRequestSchema = createInsertSchema(customRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomRequest = z.infer<typeof insertCustomRequestSchema>;
export type CustomRequest = typeof customRequestsTable.$inferSelect;

// Threaded chat between the customer and admin/staff during a custom design
// request — used to discuss demos, revisions, and final deliveries. The
// `authorRole` snapshot survives even if the user's role later changes.
export const customRequestMessageAuthorRoleEnum = pgEnum(
  "custom_request_message_author_role",
  ["customer", "admin", "staff"],
);

export const customRequestMessagesTable = pgTable("custom_request_messages", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => customRequestsTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => usersTable.id),
  authorRole: customRequestMessageAuthorRoleEnum("author_role").notNull(),
  authorName: text("author_name").notNull(),
  body: text("body").notNull().default(""),
  attachments: jsonb("attachments").$type<CustomRequestFile[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CustomRequestMessage = typeof customRequestMessagesTable.$inferSelect;
