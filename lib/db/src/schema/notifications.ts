import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  senderId: text("sender_id").notNull(),
  videoId: integer("video_id"),
  type: text("type").notNull(), // 'like', 'follow', 'comment', 'system'
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  link: text("link"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
