import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const watchProgressTable = pgTable("watch_progress", {
  id: serial("id").primaryKey(),
  userClerkId: text("user_clerk_id").notNull(),
  videoId: integer("video_id").notNull(),
  progressSeconds: integer("progress_seconds").notNull().default(0),
  progressPercent: integer("progress_percent").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWatchProgressSchema = createInsertSchema(watchProgressTable).omit({ id: true, updatedAt: true });
export type InsertWatchProgress = z.infer<typeof insertWatchProgressSchema>;
export type WatchProgress = typeof watchProgressTable.$inferSelect;
