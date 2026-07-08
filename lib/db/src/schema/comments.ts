import { pgTable, serial, integer, text, timestamp, AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull(),
  authorClerkId: text("author_clerk_id").notNull(),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => commentsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;
