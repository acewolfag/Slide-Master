import { pgTable, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { templatesTable } from "./templates";

export const wishlistTable = pgTable("wishlist", {
  userId: integer("user_id").notNull().references(() => usersTable.id),
  templateId: integer("template_id").notNull().references(() => templatesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.templateId] })]);
