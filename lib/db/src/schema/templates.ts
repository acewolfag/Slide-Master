import { pgTable, text, serial, integer, timestamp, boolean, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";

export const templateStatusEnum = pgEnum("template_status", ["active", "draft"]);

export const templatesTable = pgTable("templates", {
  id: serial("id").primaryKey(),
  titleVi: text("title_vi").notNull(),
  titleEn: text("title_en").notNull(),
  slug: text("slug").notNull().unique(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  isFree: boolean("is_free").notNull().default(false),
  thumbnailUrl: text("thumbnail_url").notNull(),
  previewImages: text("preview_images").array().notNull().default([]),
  /**
   * Path tới file PPTX/PDF gốc mà khách sẽ tải sau khi thanh toán.
   * Ví dụ: "/api/uploads/1778415471_marketing-plan.pptx".
   */
  fileUrl: text("file_url"),
  slideCount: integer("slide_count").notNull().default(20),
  aspectRatio: text("aspect_ratio").notNull().default("16:9"),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  style: text("style").notNull().default("Corporate"),
  tags: text("tags").array().notNull().default([]),
  descriptionVi: text("description_vi"),
  descriptionEn: text("description_en"),
  features: text("features").array().notNull().default([]),
  compatibleSoftware: text("compatible_software").array().notNull().default(["PowerPoint", "Google Slides", "Keynote"]),
  isFeatured: boolean("is_featured").notNull().default(false),
  isBestSeller: boolean("is_best_seller").notNull().default(false),
  avgRating: numeric("avg_rating", { precision: 3, scale: 2 }).notNull().default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  salesCount: integer("sales_count").notNull().default(0),
  status: templateStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTemplateSchema = createInsertSchema(templatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templatesTable.$inferSelect;
