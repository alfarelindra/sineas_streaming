import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const likesTable = pgTable("likes", {
  id: serial("id").primaryKey(),
  userClerkId: text("user_clerk_id").notNull(),
  videoId: integer("video_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLikeSchema = createInsertSchema(likesTable).omit({ id: true, createdAt: true });
export type InsertLike = z.infer<typeof insertLikeSchema>;
export type Like = typeof likesTable.$inferSelect;
