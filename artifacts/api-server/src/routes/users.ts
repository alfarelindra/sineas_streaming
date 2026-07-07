import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, watchlistTable, videosTable, insertUserSchema } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { UpdateMeBody, AddToWatchlistBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

async function getOrCreateUser(clerkId: string, displayName?: string) {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (existing) return existing;
  const [created] = await db.insert(usersTable).values({
    clerkId,
    displayName: displayName ?? "Pengguna Sineas",
  }).returning();
  return created;
}

// GET /users/me
router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const user = await getOrCreateUser(clerkId);
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    displayName: user.displayName,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    stripeCustomerId: user.stripeCustomerId ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

// PATCH /users/me
router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await getOrCreateUser(clerkId);
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.clerkId, clerkId)).returning();
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    displayName: user.displayName,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    stripeCustomerId: user.stripeCustomerId ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

// GET /users/watchlist
router.get("/users/watchlist", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const items = await db.select().from(watchlistTable)
    .where(eq(watchlistTable.userClerkId, clerkId))
    .orderBy(desc(watchlistTable.addedAt));

  const videoIds = items.map(i => i.videoId);
  if (!videoIds.length) { res.json([]); return; }

  const videos = await db.select().from(videosTable)
    .where(eq(videosTable.isPublic, true));
  const videoMap = new Map(videos.map(v => [v.id, v]));

  const result = videoIds
    .filter(id => videoMap.has(id))
    .map(id => {
      const v = videoMap.get(id)!;
      return {
        id: v.id,
        title: v.title,
        description: v.description ?? null,
        uploaderName: v.uploaderName,
        uploaderId: v.uploaderClerkId,
        videoUrl: v.videoUrl,
        thumbnailUrl: v.thumbnailUrl ?? null,
        duration: v.duration,
        viewCount: v.viewCount,
        likeCount: v.likeCount,
        genre: v.genre ?? null,
        isPublic: v.isPublic,
        isPremium: v.isPremium,
        minimumPlan: v.minimumPlan ?? null,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      };
    });
  res.json(result);
});

// POST /users/watchlist
router.post("/users/watchlist", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const parsed = AddToWatchlistBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(watchlistTable)
    .where(and(eq(watchlistTable.userClerkId, clerkId), eq(watchlistTable.videoId, parsed.data.videoId)));
  if (existing) { res.status(201).json({ id: existing.id, videoId: existing.videoId, addedAt: existing.addedAt.toISOString() }); return; }

  const [item] = await db.insert(watchlistTable).values({ userClerkId: clerkId, videoId: parsed.data.videoId }).returning();
  res.status(201).json({ id: item.id, videoId: item.videoId, addedAt: item.addedAt.toISOString() });
});

// DELETE /users/watchlist/:videoId
router.delete("/users/watchlist/:videoId", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const raw = Array.isArray(req.params.videoId) ? req.params.videoId[0] : req.params.videoId;
  const videoId = parseInt(raw, 10);
  await db.delete(watchlistTable).where(and(eq(watchlistTable.userClerkId, clerkId), eq(watchlistTable.videoId, videoId)));
  res.status(204).send();
});

// GET /creators/:id — public creator profile by clerkId
router.get("/creators/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const clerkId = decodeURIComponent(raw);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));

  const [stats] = await db
    .select({
      count: sql<number>`count(*)::int`,
      views: sql<number>`coalesce(sum(${videosTable.viewCount}), 0)::int`,
      likes: sql<number>`coalesce(sum(${videosTable.likeCount}), 0)::int`,
    })
    .from(videosTable)
    .where(and(eq(videosTable.uploaderClerkId, clerkId), eq(videosTable.isPublic, true)));

  const videoCount = stats?.count ?? 0;

  let displayName = user?.displayName;
  if (!displayName && videoCount > 0) {
    const [firstVideo] = await db
      .select({ uploaderName: videosTable.uploaderName })
      .from(videosTable)
      .where(and(eq(videosTable.uploaderClerkId, clerkId), eq(videosTable.isPublic, true)))
      .limit(1);
    displayName = firstVideo?.uploaderName;
  }

  if (!user && videoCount === 0) {
    res.status(404).json({ error: "Kreator tidak ditemukan" });
    return;
  }

  res.json({
    clerkId,
    displayName: displayName ?? "Kreator Sineas",
    bio: user?.bio ?? null,
    avatarUrl: user?.avatarUrl ?? null,
    videoCount,
    totalViews: stats?.views ?? 0,
    totalLikes: stats?.likes ?? 0,
  });
});

export { getOrCreateUser };
export default router;
