import { Router } from "express";
import { db } from "@workspace/db";
import { genresTable, videosTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/genres", async (req, res): Promise<void> => {
  const genres = await db.select().from(genresTable);
  const counts = await db.select({ genre: videosTable.genre, count: sql<number>`count(*)` })
    .from(videosTable)
    .where(eq(videosTable.isPublic, true))
    .groupBy(videosTable.genre);
  const countMap = new Map(counts.map(c => [c.genre, Number(c.count)]));

  res.json(genres.map(g => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    videoCount: countMap.get(g.name) ?? 0,
  })));
});

export default router;
