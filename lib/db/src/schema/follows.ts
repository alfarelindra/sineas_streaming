import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const followsTable = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerClerkId: text("follower_clerk_id").notNull(),
    creatorClerkId: text("creator_clerk_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("follows_follower_creator_unique").on(t.followerClerkId, t.creatorClerkId)]
);

export const insertFollowSchema = createInsertSchema(followsTable).omit({ id: true, createdAt: true });
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof followsTable.$inferSelect;
