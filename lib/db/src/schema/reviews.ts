import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { templatesTable } from "./templates";
import { usersTable } from "./users";

export const reviewsTable = pgTable("reviews", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => templatesTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  imageUrl: text("image_url"),
  isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),
  // Slugs of positive criteria the user ticked when submitting the review.
  // Source-of-truth for the slug values lives in `review_criteria.slug`.
  criteriaTags: text("criteria_tags").array().notNull().default([]),
  // Slugs of moderation labels the admin applied (spam, abuse, off-topic, ...).
  // Source-of-truth for the slug values lives in `review_moderation_tags.slug`.
  moderationTags: text("moderation_tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReviewSchema = createInsertSchema(reviewsTable).omit({ id: true, createdAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviewsTable.$inferSelect;

// Positive criteria users tick when writing a review. Admin manages this list
// from the admin review page.
export const reviewCriteriaTable = pgTable("review_criteria", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  labelVi: text("label_vi").notNull(),
  labelEn: text("label_en"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReviewCriteria = typeof reviewCriteriaTable.$inferSelect;

// Moderation labels admins apply to reviews. User-invisible.
export const reviewModerationTagsTable = pgTable("review_moderation_tags", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  labelVi: text("label_vi").notNull(),
  // Tailwind color hint, e.g. "red", "amber", "slate" — used by the admin UI
  // to color-code the badge.
  color: text("color").notNull().default("red"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReviewModerationTag = typeof reviewModerationTagsTable.$inferSelect;
