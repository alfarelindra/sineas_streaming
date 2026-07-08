import { Router } from "express";
import { db } from "@workspace/db";
import {
  videosTable,
  usersTable,
  watchProgressTable,
  likesTable,
  commentsTable,
  insertVideoSchema,
  insertCommentSchema,
  notificationsTable,
  followsTable,
} from "@workspace/db";
import { eq, desc, ilike, and, sql, inArray, gte, count } from "drizzle-orm";
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


/**
 * Format a video row (optionally joined with a user row) into the API response shape.
 * When the joined user is provided, use their current displayName/avatarUrl from the
 * users table instead of the snapshot value stored in videos.uploaderName.
 */
function formatVideo(v: any, uploader?: any) {
  return {
    id: v.id,
    title: v.title,
    description: v.description ?? null,
    uploaderName: uploader?.displayName ?? v.uploaderName ?? null,
    uploaderAvatar: uploader?.avatarUrl ?? null,
    uploaderId: v.uploaderClerkId,
    videoUrl: v.videoUrl,
    url_360p: v.url_360p ?? null,
    url_480p: v.url_480p ?? null,
    url_720p: v.url_720p ?? null,
    url_1080p: v.url_1080p ?? null,
    url_4k: v.url_4k ?? null,
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

/**
 * Batch-fetch uploaders for a list of videos and return a map keyed by clerkId.
 */
async function fetchUploaderMap(videos: any[]): Promise<Map<string, any>> {
  const clerkIds = [...new Set(videos.map((v) => v.uploaderClerkId).filter(Boolean))];
  if (!clerkIds.length) return new Map();
  const uploaders = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.clerkId, clerkIds));
  return new Map(uploaders.map((u) => [u.clerkId, u]));
}

// GET /videos
router.get("/videos", async (req, res): Promise<void> => {
  const parsed = ListVideosQueryParams.safeParse(req.query);
  const { genre, search, page = 1, limit = 20 } = parsed.success ? parsed.data : { genre: undefined, search: undefined, page: 1, limit: 20 };

  const offset = ((page as number) - 1) * (limit as number);
  const conditions = [eq(videosTable.isPublic, true)];
  if (genre) conditions.push(eq(videosTable.genre, genre));
  if (search) conditions.push(ilike(videosTable.title, `%${search}%`));
  
  const uploaderId = req.query.uploaderId as string | undefined;
  if (uploaderId) {
    conditions.push(eq(videosTable.uploaderClerkId, uploaderId));
  }

  const [videos, countResult] = await Promise.all([
    db.select().from(videosTable).where(and(...conditions)).orderBy(desc(videosTable.createdAt)).limit(limit as number).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(videosTable).where(and(...conditions)),
  ]);

  const uploaderMap = await fetchUploaderMap(videos);
  res.json({ videos: videos.map((v) => formatVideo(v, uploaderMap.get(v.uploaderClerkId))), total: Number(countResult[0]?.count ?? 0), page, limit });
});

// POST /videos
router.post("/videos", requireAuth, async (req, res): Promise<void> => {
  try {
    const parsed = CreateVideoBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Extra server-side guards
    const titleTrimmed = parsed.data.title.trim();
    if (!titleTrimmed) {
      res.status(400).json({ error: "Judul tidak boleh kosong" });
      return;
    }
    if (!parsed.data.videoUrl.trim()) {
      res.status(400).json({ error: "URL video diperlukan" });
      return;
    }

    const userId = (req as any).auth.userId;
    // ── REQUIRED DEBUG LOG ──────────────────────────────────────────────
    console.log("=== DEBUG UPLOAD ===", { userId });
    // ────────────────────────────────────────────────────────────────────

    // If userId from Clerk is not readable or null, abort and return 401 Unauthorized
    if (!userId) {
      res.status(401).json({ error: "Unauthorized: Sesi Clerk tidak terbaca atau tidak valid" });
      return;
    }

    const user = (req as any).dbUser;
    // dbUser is always populated by requireAuth middleware (auto-created if new)
    const displayName = user?.displayName ?? "Sineas Creator";

    console.log("[UPLOAD] dbUser dari tabel users:", {
      id: user?.id,
      clerkId: user?.clerkId,
      displayName: user?.displayName,
    });

    // ── UPLOAD ELIGIBILITY VALIDATION ────────────────────────────────────
    const requestedPlan: string = (parsed.data.minimumPlan ?? "").toLowerCase();

    if (requestedPlan !== "") {
      // Define minimum follower thresholds per plan
      const followerThresholds: Record<string, number> = {
        basic: 100,
        premium: 500,
        ultra: 1000,
      };
      // Subscription tier rank (higher = more access)
      const tierRank: Record<string, number> = { basic: 1, premium: 2, ultra: 3 };

      // Determine user's active subscription tier from DB
      let userTier: string | null = null;
      if (user?.stripeSubscriptionId) {
        try {
          const { getUncachableStripeClient } = await import("../stripeClient");
          const stripe = await getUncachableStripeClient();
          const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
            expand: ["items.data.price.product"],
          });
          if (sub.status === "active" || sub.status === "trialing") {
            const product = (sub.items.data[0]?.price?.product as any);
            userTier = product?.metadata?.tier ?? null;
          }
        } catch (stripeErr) {
          console.warn("[UPLOAD] Could not verify Stripe subscription, falling back to follower check:", stripeErr);
        }
      }

      // Count followers of this uploader
      const [followerResult] = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(followsTable)
        .where(eq(followsTable.creatorClerkId, userId));
      const followerCount = followerResult?.cnt ?? 0;

      const requiredRank = tierRank[requestedPlan] ?? 0;
      const userRank = userTier ? (tierRank[userTier] ?? 0) : 0;
      const hasValidSubscription = userRank >= requiredRank;
      const requiredFollowers = followerThresholds[requestedPlan] ?? 0;
      const hasEnoughFollowers = followerCount >= requiredFollowers;

      if (!hasValidSubscription && !hasEnoughFollowers) {
        const planLabel = requestedPlan.charAt(0).toUpperCase() + requestedPlan.slice(1);
        res.status(403).json({
          error: `Kamu belum memenuhi syarat untuk membuat konten dengan minimum paket "${planLabel}". ` +
            `Kamu membutuhkan: Langganan ${planLabel} ATAU minimal ${requiredFollowers} followers ` +
            `(saat ini kamu memiliki ${followerCount} followers).`,
        });
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    const [video] = await db.insert(videosTable).values({
      title: titleTrimmed,
      description: parsed.data.description?.trim() || undefined,
      uploaderClerkId: userId,
      uploaderName: displayName,
      videoUrl: parsed.data.videoUrl.trim(),
      thumbnailUrl: parsed.data.thumbnailUrl?.trim() || undefined,
      duration: Math.max(0, parsed.data.duration),
      genre: parsed.data.genre || undefined,
      isPublic: parsed.data.isPublic ?? true,
      isPremium: parsed.data.isPremium ?? false,
      minimumPlan: parsed.data.minimumPlan || undefined,
    }).returning();

    console.log("[UPLOAD] Video berhasil disimpan — id:", video.id, "uploaderClerkId:", video.uploaderClerkId);
    res.status(201).json(formatVideo(video, user));
  } catch (error: any) {
    req.log.error({ err: error }, "Failed to insert video to database");
    console.error("DATABASE INSERT ERROR:", error);
    res.status(500).json({ error: error.message || "Gagal menyimpan video ke database" });
  }
});

// GET /videos/featured
router.get("/videos/featured", async (req, res): Promise<void> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Query popular public videos in the last 30 days based on Score = views + likes * 3
  let videos = await db.select().from(videosTable)
    .where(and(
      eq(videosTable.isPublic, true),
      gte(videosTable.createdAt, thirtyDaysAgo)
    ))
    .orderBy(
      desc(sql<number>`${videosTable.viewCount} + (${videosTable.likeCount} * 3)`),
      desc(videosTable.createdAt)
    )
    .limit(5);

  // Fallback: If no videos were uploaded in the last 30 days, take overall popular public videos
  if (videos.length === 0) {
    videos = await db.select().from(videosTable)
      .where(eq(videosTable.isPublic, true))
      .orderBy(
        desc(sql<number>`${videosTable.viewCount} + (${videosTable.likeCount} * 3)`),
        desc(videosTable.createdAt)
      )
      .limit(5);
  }

  const uploaderMap = await fetchUploaderMap(videos);
  res.json(videos.map((v) => formatVideo(v, uploaderMap.get(v.uploaderClerkId))));
});

// GET /videos/trending
router.get("/videos/trending", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? 10));
  const videos = await db.select().from(videosTable)
    .where(eq(videosTable.isPublic, true))
    .orderBy(desc(videosTable.viewCount)).limit(limit);
  const uploaderMap = await fetchUploaderMap(videos);
  res.json(videos.map((v) => formatVideo(v, uploaderMap.get(v.uploaderClerkId))));
});

// GET /videos/mine — returns ALL videos (incl. private) owned by the authenticated user.
// Used exclusively by the creator dashboard so it is isolated from the public listing.
// Must be registered before /videos/:id to avoid route collision.
router.get("/videos/mine", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const page = Math.max(1, parseInt(String(req.query.page ?? 1), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? 50), 10) || 50));
  const offset = (page - 1) * limit;

  // ── DEBUG: log the clerkId being queried ────────────────────────────
  console.log("=== DEBUG DASHBOARD ===", { currentUserId: clerkId });
  // ────────────────────────────────────────────────────────────────────

  const [videos, countResult] = await Promise.all([
    db.select().from(videosTable)
      .where(eq(videosTable.uploaderClerkId, clerkId || ""))
      .orderBy(desc(videosTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(videosTable)
      .where(eq(videosTable.uploaderClerkId, clerkId || "")),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  console.log("[MINE] Ditemukan", total, "video untuk clerkId:", clerkId);

  // Uploader is always the caller themselves — still pass for consistent shape
  const uploaderMap = await fetchUploaderMap(videos);
  res.json({
    videos: videos.map((v) => formatVideo(v, uploaderMap.get(v.uploaderClerkId))),
    total,
    page,
    limit,
  });
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
  const uploaderMap = await fetchUploaderMap(videos);

  const result = progresses
    .filter(p => videoMap.has(p.videoId))
    .map(p => ({
      ...formatVideo(videoMap.get(p.videoId)!, uploaderMap.get(videoMap.get(p.videoId)!.uploaderClerkId)),
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
    const videos = await db.select().from(videosTable).where(inArray(videosTable.id, videoIds));
    const videoMap = new Map(videos.map(v => [v.id, v]));
    const uploaderMap = await fetchUploaderMap(videos);
    items = progresses
      .filter(p => videoMap.has(p.videoId))
      .map(p => {
        const v = videoMap.get(p.videoId)!;
        return ({
          ...formatVideo(v, uploaderMap.get(v.uploaderClerkId)),
          progressSeconds: p.progressSeconds,
          progressPercent: p.progressPercent,
          completed: p.completed,
          watchedAt: p.updatedAt.toISOString(),
        });
      });
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

  // Fetch the uploader's current profile from users table (JOIN equivalent)
  const [uploader] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, video.uploaderClerkId));

  // Increment view count
  await db.update(videosTable).set({ viewCount: video.viewCount + 1 }).where(eq(videosTable.id, id));
  res.json(formatVideo({ ...video, viewCount: video.viewCount + 1 }, uploader));
});

// POST /video/:id/view & POST /videos/:id/view
router.post(["/video/:id/view", "/videos/:id/view"], async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const videoId = parseInt(raw, 10);

  if (Number.isNaN(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  const [video] = await db
    .update(videosTable)
    .set({
      viewCount: sql`${videosTable.viewCount} + 1`
    })
    .where(eq(videosTable.id, videoId))
    .returning();

  if (!video) {
    res.status(404).json({ error: "Video tidak ditemukan" });
    return;
  }

  res.json({ id: video.id, viewCount: video.viewCount });
});

// PATCH /videos/:id
router.patch("/videos/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateVideoBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [video] = await db.update(videosTable).set(parsed.data).where(eq(videosTable.id, id)).returning();
  if (!video) { res.status(404).json({ error: "Not found" }); return; }

  const [uploader] = await db.select().from(usersTable).where(eq(usersTable.clerkId, video.uploaderClerkId));
  res.json(formatVideo(video, uploader));
});

// DELETE /videos/:id
router.delete("/videos/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const clerkId = (req as any).auth.userId;

  // Fetch video first to verify ownership
  const [video] = await db.select({ id: videosTable.id, uploaderClerkId: videosTable.uploaderClerkId })
    .from(videosTable)
    .where(eq(videosTable.id, id));

  if (!video) { res.status(404).json({ error: "Video tidak ditemukan" }); return; }

  // Only the original uploader may delete their own video
  if (video.uploaderClerkId !== clerkId) {
    res.status(403).json({ error: "Forbidden: kamu bukan pemilik video ini" });
    return;
  }

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
    
    // Create like notification
    try {
      const [sender] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
      const senderName = sender?.displayName || "Seseorang";
      
      if (clerkId !== video.uploaderClerkId) {
        await db.insert(notificationsTable).values({
          userId: video.uploaderClerkId,
          senderId: clerkId,
          videoId: video.id,
          type: "like",
          message: `${senderName} menyukai video Anda '${video.title}'`,
          link: `/watch/${video.id}`,
          read: false,
        });
      }
    } catch (e) {
      console.error("Gagal membuat notifikasi like:", e);
    }

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

  // Batch-fetch authors from users table for up-to-date display names
  const authorClerkIds = [...new Set(comments.map((c) => c.authorClerkId).filter(Boolean))];
  let authorMap: Map<string, any> = new Map();
  if (authorClerkIds.length) {
    const authors = await db
      .select()
      .from(usersTable)
      .where(inArray(usersTable.clerkId, authorClerkIds));
    authorMap = new Map(authors.map((a) => [a.clerkId, a]));
  }

  res.json(comments.map(c => {
    const author = authorMap.get(c.authorClerkId);
    return {
      id: c.id,
      videoId: c.videoId,
      parentId: c.parentId,
      authorName: author?.displayName ?? c.authorName,
      authorAvatar: author?.avatarUrl ?? null,
      authorId: c.authorClerkId,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    };
  }));
});

// POST /videos/:id/comments
router.post("/videos/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const clerkId = (req as any).auth.userId;
  const user = (req as any).dbUser;
  const parsed = CreateCommentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const bodyTrimmed = parsed.data.body.trim();
  if (!bodyTrimmed) {
    res.status(400).json({ error: "Komentar tidak boleh kosong" });
    return;
  }

  // Ensure the video exists before inserting a comment
  const [video] = await db.select({ id: videosTable.id }).from(videosTable).where(eq(videosTable.id, id));
  if (!video) { res.status(404).json({ error: "Video tidak ditemukan" }); return; }

  // dbUser is always populated by requireAuth (auto-created if new). Use the
  // current displayName from the users table, never a stale snapshot.
  const authorName = user?.displayName ?? "Pengguna Sineas";

  const [comment] = await db.insert(commentsTable).values({
    videoId: id,
    authorClerkId: clerkId,
    authorName,
    body: bodyTrimmed,
    parentId: parsed.data.parentId ?? null,
  }).returning();

  res.status(201).json({
    id: comment.id,
    videoId: comment.videoId,
    parentId: comment.parentId,
    authorName: comment.authorName,
    authorAvatar: user?.avatarUrl ?? null,
    authorId: comment.authorClerkId,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  });
});

export default router;
