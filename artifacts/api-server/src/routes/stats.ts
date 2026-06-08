import { Router } from "express";
import { db } from "@workspace/db";
import { videosTable, usersTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res): Promise<void> => {
  const [videoStats] = await db.select({
    totalVideos: sql<number>`count(*)`,
    totalViews: sql<number>`sum(${videosTable.viewCount})`,
  }).from(videosTable).where(eq(videosTable.isPublic, true));

  const [userStats] = await db.select({ totalUsers: sql<number>`count(*)` }).from(usersTable);

  const genreCounts = await db.select({
    genre: videosTable.genre,
    count: sql<number>`count(*)`,
  }).from(videosTable).where(eq(videosTable.isPublic, true)).groupBy(videosTable.genre);

  res.json({
    totalVideos: Number(videoStats.totalVideos ?? 0),
    totalViews: Number(videoStats.totalViews ?? 0),
    totalUsers: Number(userStats.totalUsers ?? 0),
    videosByGenre: genreCounts
      .filter(g => g.genre)
      .map(g => ({ genre: g.genre!, count: Number(g.count) })),
  });
});

export default router;
