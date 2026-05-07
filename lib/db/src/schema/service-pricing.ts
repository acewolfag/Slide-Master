import { pgTable, serial, text, numeric, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const servicePricingTable = pgTable("service_pricing", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  slides: text("slides").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  deliveryDays: integer("delivery_days").notNull(),
  revisions: text("revisions").notNull(),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  featuresEn: jsonb("features_en").$type<string[]>().notNull().default([]),
  isHighlight: boolean("is_highlight").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertServicePricingSchema = createInsertSchema(servicePricingTable).omit({ id: true, updatedAt: true });
export type InsertServicePricing = z.infer<typeof insertServicePricingSchema>;
export type ServicePricing = typeof servicePricingTable.$inferSelect;
