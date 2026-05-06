import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const blogPostsTable = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  titleVi: text("title_vi").notNull(),
  titleEn: text("title_en").notNull(),
  excerptVi: text("excerpt_vi").notNull(),
  excerptEn: text("excerpt_en").notNull(),
  contentVi: text("content_vi").notNull(),
  contentEn: text("content_en").notNull(),
  coverImageUrl: text("cover_image_url").notNull(),
  author: text("author").notNull(),
  tags: text("tags").array().notNull().default([]),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPostsTable).omit({ id: true, createdAt: true });
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPostsTable.$inferSelect;
