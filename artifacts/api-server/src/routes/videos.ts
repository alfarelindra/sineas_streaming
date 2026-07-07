import { Router } from "express";
import { db } from "@workspace/db";
import {
  videosTable,
  watchProgressTable,
  likesTable,
  commentsTable,
  insertVideoSchema,
  insertCommentSchema,
} from "@workspace/db";
import { eq, desc, ilike, and, sql } from "drizzle-orm";
import {
  CreateVideoBody,
  UpdateVideoBody,
  UpdateWatchProgressBody,
  RestoreWatchHistoryBody,
  CreateCommentBody,
  ListVideosQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function formatVideo(v: any) {
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
}

// GET /videos
router.get("/videos", async (req, res): Promise<void> => {
  const parsed = ListVideosQueryParams.safeParse(req.query);
  const { genre, search, page = 1, limit = 20 } = parsed.success ? parsed.data : { genre: undefined, search: undefined, page: 1, limit: 20 };

  const offset = ((page as number) - 1) * (limit as number);
  const conditions = [eq(videosTable.isPublic, true)];
  if (genre) conditions.push(eq(videosTable.genre, genre));
  if (search) conditions.push(ilike(videosTable.title, `%${search}%`));

  const [videos, countResult] = await Promise.all([
    db.select().from(videosTable).where(and(...conditions)).orderBy(desc(videosTable.createdAt)).limit(limit as number).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(videosTable).where(and(...conditions)),
  ]);

  res.json({ videos: videos.map(formatVideo), total: Number(countResult[0]?.count ?? 0), page, limit });
});

// POST /videos
router.post("/videos", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const clerkUser = (req as any).auth;
  const user = (req as any).dbUser;
  const displayName = user?.displayName ?? clerkUser?.userId ?? "Sineas Creator";

  const [video] = await db.insert(videosTable).values({
    title: parsed.data.title,
    description: parsed.data.description,
    uploaderClerkId: clerkUser.userId,
    uploaderName: displayName,
    videoUrl: parsed.data.videoUrl,
    thumbnailUrl: parsed.data.thumbnailUrl,
    duration: parsed.data.duration,
    genre: parsed.data.genre,
    isPublic: parsed.data.isPublic ?? true,
    isPremium: parsed.data.isPremium ?? false,
    minimumPlan: parsed.data.minimumPlan,
  }).returning();

  res.status(201).json(formatVideo(video));
});

// GET /videos/featured
router.get("/videos/featured", async (req, res): Promise<void> => {
  const videos = await db.select().from(videosTable)
    .where(and(eq(videosTable.isPublic, true), eq(videosTable.featured, true)))
    .orderBy(desc(videosTable.createdAt)).limit(5);
  res.json(videos.map(formatVideo));
});

// GET /videos/trending
router.get("/videos/trending", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? 10));
  const videos = await db.select().from(videosTable)
    .where(eq(videosTable.isPublic, true))
    .orderBy(desc(videosTable.viewCount)).limit(limit);
  res.json(videos.map(formatVideo));
});

// GET /videos/continue-watching
router.get("/videos/continue-watching", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const progresses = await db.select().from(watchProgressTable)
    .where(and(eq(watchProgressTable.userClerkId, clerkId), eq(watchProgressTable.completed, false)))
    .orderBy(desc(watchProgressTable.updatedAt)).limit(10);

  const videoIds = progresses.map(p => p.videoId);
  if (!videoIds.length) { res.json([]); return; }

  const videos = await db.select().from(videosTable).where(sql`${videosTable.id} = ANY(${videoIds})`);
  const videoMap = new Map(videos.map(v => [v.id, v]));

  const result = progresses
    .filter(p => videoMap.has(p.videoId))
    .map(p => ({
      ...formatVideo(videoMap.get(p.videoId)!),
      progressSeconds: p.progressSeconds,
      progressPercent: p.progressPercent,
    }));
  res.json(result);
});

// GET /videos/history  (full watch history incl. completed, paginated) — must precede /videos/:id
router.get("/videos/history", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const page = Math.max(1, parseInt(String(req.query.page ?? 1), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 24), 10) || 24));
  const offset = (page - 1) * limit;

  const completedRaw = req.query.completed;
  let completedFilter: boolean | undefined;
  if (completedRaw === "true") completedFilter = true;
  else if (completedRaw === "false") completedFilter = false;

  const whereClause = completedFilter === undefined
    ? eq(watchProgressTable.userClerkId, clerkId)
    : and(
        eq(watchProgressTable.userClerkId, clerkId),
        eq(watchProgressTable.completed, completedFilter),
      );

  const [progresses, countResult] = await Promise.all([
    db.select().from(watchProgressTable)
      .where(whereClause)
      .orderBy(desc(watchProgressTable.updatedAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(watchProgressTable)
      .where(whereClause),
  ]);

  const videoIds = progresses.map(p => p.videoId);
  let items: any[] = [];
  if (videoIds.length) {
    const videos = await db.select().from(videosTable).where(sql`${videosTable.id} = ANY(${videoIds})`);
    const videoMap = new Map(videos.map(v => [v.id, v]));
    items = progresses
      .filter(p => videoMap.has(p.videoId))
      .map(p => ({
        ...formatVideo(videoMap.get(p.videoId)!),
        progressSeconds: p.progressSeconds,
        progressPercent: p.progressPercent,
        completed: p.completed,
        watchedAt: p.updatedAt.toISOString(),
      }));
  }

  res.json({ items, total: Number(countResult[0]?.count ?? 0), page, limit });
});

// DELETE /videos/history  (clear entire watch history) — must precede /videos/:id
// Returns snapshots of the removed rows so the client can offer an undo.
router.delete("/videos/history", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const removed = await db.delete(watchProgressTable)
    .where(eq(watchProgressTable.userClerkId, clerkId))
    .returning();
  res.json({
    items: removed.map(r => ({
      videoId: r.videoId,
      progressSeconds: r.progressSeconds,
      progressPercent: r.progressPercent,
      completed: r.completed,
      watchedAt: r.updatedAt.toISOString(),
    })),
  });
});

// POST /videos/history/restore  (undo a removal) — must precede /videos/:id
router.post("/videos/history/restore", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const parsed = RestoreWatchHistoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const items = parsed.data.items;
  if (items.length) {
    await db.insert(watchProgressTable)
      .values(items.map(item => ({
        userClerkId: clerkId,
        videoId: item.videoId,
        progressSeconds: item.progressSeconds,
        progressPercent: item.progressPercent,
        completed: item.completed,
        updatedAt: new Date(item.watchedAt),
      })))
      .onConflictDoNothing();
  }
  res.status(204).send();
});

// GET /videos/:id
router.get("/videos/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, id));
  if (!video) { res.status(404).json({ error: "Not found" }); return; }
  // Increment view count
  await db.update(videosTable).set({ viewCount: video.viewCount + 1 }).where(eq(videosTable.id, id));
  res.json(formatVideo({ ...video, viewCount: video.viewCount + 1 }));
});

// PATCH /videos/:id
router.patch("/videos/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateVideoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [video] = await db.update(videosTable).set(parsed.data).where(eq(videosTable.id, id)).returning();
  if (!video) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatVideo(video));
});

// DELETE /videos/:id
router.delete("/videos/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(videosTable).where(eq(videosTable.id, id));
  res.status(204).send();
});

// GET /videos/:id/watch
router.get("/videos/:id/watch", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const clerkId = (req as any).auth.userId;
  const [progress] = await db.select().from(watchProgressTable)
    .where(and(eq(watchProgressTable.videoId, id), eq(watchProgressTable.userClerkId, clerkId)));
  res.json(progress ?? { videoId: id, progressSeconds: 0, progressPercent: 0, completed: false });
});

// POST /videos/:id/watch
router.post("/videos/:id/watch", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const clerkId = (req as any).auth.userId;
  const parsed = UpdateWatchProgressBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(watchProgressTable)
    .where(and(eq(watchProgressTable.videoId, id), eq(watchProgressTable.userClerkId, clerkId)));

  const [video] = await db.select({ duration: videosTable.duration }).from(videosTable).where(eq(videosTable.id, id));
  const duration = video?.duration ?? 1;
  const pct = Math.round((parsed.data.progressSeconds / duration) * 100);

  if (existing) {
    const [updated] = await db.update(watchProgressTable)
      .set({ progressSeconds: parsed.data.progressSeconds, progressPercent: pct, completed: parsed.data.completed ?? false })
      .where(and(eq(watchProgressTable.videoId, id), eq(watchProgressTable.userClerkId, clerkId)))
      .returning();
    res.json({ videoId: updated.videoId, progressSeconds: updated.progressSeconds, progressPercent: updated.progressPercent, completed: updated.completed });
  } else {
    const [created] = await db.insert(watchProgressTable)
      .values({ userClerkId: clerkId, videoId: id, progressSeconds: parsed.data.progressSeconds, progressPercent: pct, completed: parsed.data.completed ?? false })
      .returning();
    res.json({ videoId: created.videoId, progressSeconds: created.progressSeconds, progressPercent: created.progressPercent, completed: created.completed });
  }
});

// DELETE /videos/:id/watch  (remove a single video from history)
// Returns a snapshot of the removed row so the client can offer an undo.
router.delete("/videos/:id/watch", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const clerkId = (req as any).auth.userId;
  const [removed] = await db.delete(watchProgressTable)
    .where(and(eq(watchProgressTable.videoId, id), eq(watchProgressTable.userClerkId, clerkId)))
    .returning();
  if (!removed) { res.status(404).json({ error: "Not found" }); return; }
  res.json({
    videoId: removed.videoId,
    progressSeconds: removed.progressSeconds,
    progressPercent: removed.progressPercent,
    completed: removed.completed,
    watchedAt: removed.updatedAt.toISOString(),
  });
});

// POST /videos/:id/like
router.post("/videos/:id/like", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const clerkId = (req as any).auth.userId;

  const [existing] = await db.select().from(likesTable)
    .where(and(eq(likesTable.videoId, id), eq(likesTable.userClerkId, clerkId)));

  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, id));
  if (!video) { res.status(404).json({ error: "Not found" }); return; }

  if (existing) {
    await db.delete(likesTable).where(and(eq(likesTable.videoId, id), eq(likesTable.userClerkId, clerkId)));
    await db.update(videosTable).set({ likeCount: Math.max(0, video.likeCount - 1) }).where(eq(videosTable.id, id));
    res.json({ liked: false, likeCount: Math.max(0, video.likeCount - 1) });
  } else {
    await db.insert(likesTable).values({ userClerkId: clerkId, videoId: id });
    await db.update(videosTable).set({ likeCount: video.likeCount + 1 }).where(eq(videosTable.id, id));
    res.json({ liked: true, likeCount: video.likeCount + 1 });
  }
});

// GET /videos/:id/comments
router.get("/videos/:id/comments", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const comments = await db.select().from(commentsTable)
    .where(eq(commentsTable.videoId, id))
    .orderBy(desc(commentsTable.createdAt));
  res.json(comments.map(c => ({
    id: c.id,
    videoId: c.videoId,
    authorName: c.authorName,
    authorId: c.authorClerkId,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  })));
});

// POST /videos/:id/comments
router.post("/videos/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const clerkId = (req as any).auth.userId;
  const user = (req as any).dbUser;
  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [comment] = await db.insert(commentsTable).values({
    videoId: id,
    authorClerkId: clerkId,
    authorName: user?.displayName ?? "Pengguna Sineas",
    body: parsed.data.body,
  }).returning();
  res.status(201).json({
    id: comment.id,
    videoId: comment.videoId,
    authorName: comment.authorName,
    authorId: comment.authorClerkId,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  });
});

export default router;
