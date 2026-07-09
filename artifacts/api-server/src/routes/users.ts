import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, watchlistTable, videosTable, followsTable, insertUserSchema, notificationsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { UpdateMeBody, AddToWatchlistBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { clerkClient } from "@clerk/express";

const router = Router();

async function getOrCreateUser(clerkId: string, displayName?: string) {
  // Step 1: check if already exists
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (existing) {
    // Async-sync profile data from Clerk if incomplete (non-blocking)
    if (!existing.avatarUrl || existing.displayName === "Pengguna Sineas" || !existing.username) {
      try {
        const clerkUser = await clerkClient.users.getUser(clerkId);
        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()
          || clerkUser.username
          || clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0]
          || "Pengguna Sineas";
        const avatar = clerkUser.imageUrl || null;
        const uName = clerkUser.username || null;

        const [updated] = await db.update(usersTable)
          .set({
            displayName: existing.displayName === "Pengguna Sineas" ? name : existing.displayName,
            avatarUrl: existing.avatarUrl ? existing.avatarUrl : avatar,
            username: existing.username ? existing.username : uName,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.clerkId, clerkId))
          .returning();
        return updated ?? existing;
      } catch (err) {
        console.error("Gagal sinkronisasi Clerk (non-fatal):", (err as Error)?.message);
        return existing; // return what we have — don't fail the request
      }
    }
    return existing;
  }

  // Step 2: Insert with default data FIRST — no Clerk API dependency
  // This guarantees the row exists before we try to enrich it
  const defaultName = displayName?.trim() || "Kreator Sineas";
  const [created] = await db.insert(usersTable).values({
    clerkId,
    displayName: defaultName,
    avatarUrl: null,
    username: null,
  }).onConflictDoNothing().returning();

  // Step 3: Try to enrich with real Clerk profile data
  const baseUser = created ?? (await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).then(r => r[0]));
  if (!baseUser) {
    throw new Error("Gagal membuat data user di database");
  }


  try {
    const clerkUser = await clerkClient.users.getUser(clerkId);
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()
      || clerkUser.username
      || clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0]
      || defaultName;
    const avatar = clerkUser.imageUrl || null;
    const uName = clerkUser.username || null;

    const [enriched] = await db.update(usersTable)
      .set({ displayName: name, avatarUrl: avatar, username: uName, updatedAt: new Date() })
      .where(eq(usersTable.clerkId, clerkId))
      .returning();
    return enriched ?? baseUser;
  } catch (err) {
    console.error("Gagal enrich user dari Clerk (non-fatal, menggunakan default):", (err as Error)?.message);
    return baseUser; // Return the default-named user — still valid!
  }
}

// GET /users/me
router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const user = await getOrCreateUser(clerkId);
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    displayName: user.displayName,
    username: user.username ?? null,
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
    username: user.username ?? null,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    stripeCustomerId: user.stripeCustomerId ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

// PATCH /user/update
router.patch("/user/update", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await getOrCreateUser(clerkId);
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.clerkId, clerkId)).returning();
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    displayName: user.displayName,
    username: user.username ?? null,
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
  console.log("[CREATOR PROFILE] Mencari profil untuk clerkId:", clerkId);

  let user: typeof import("@workspace/db").usersTable.$inferSelect | null = null;

  if (clerkId.startsWith("user_")) {
    // ── LEVEL 1: getOrCreateUser (insert default + try Clerk sync) ───────
    try {
      user = await getOrCreateUser(clerkId) as any;
      console.log("[CREATOR PROFILE] Level 1 OK - user.id:", user?.id);
    } catch (err) {
      console.error("[CREATOR PROFILE] Level 1 gagal:", (err as Error)?.message);
    }

    // ── LEVEL 2: Direct DB insert jika Level 1 gagal ─────────────────────
    if (!user) {
      try {
        console.log("[CREATOR PROFILE] Level 2 - direct insert fallback...");
        await db.insert(usersTable).values({
          clerkId,
          displayName: "Kreator Sineas",
          avatarUrl: null,
          username: null,
        }).onConflictDoNothing();
        const [fetched] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
        user = fetched ?? null;
        console.log("[CREATOR PROFILE] Level 2 OK - user.id:", user?.id);
      } catch (dbErr) {
        console.error("[CREATOR PROFILE] Level 2 gagal:", (dbErr as Error)?.message);
      }
    }
  } else {
    // Non-Clerk ID → DB lookup only
    try {
      const [found] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
      user = found ?? null;
    } catch (err) {
      console.error("[CREATOR PROFILE] DB lookup gagal:", (err as Error)?.message);
    }
  }

  console.log("[CREATOR PROFILE] Final user:", user ? `id=${user.id} name=${user.displayName}` : "NULL");

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

  // Only return 404 if BOTH DB insert levels failed (DB unreachable)
  if (!user) {
    console.error("[CREATOR PROFILE] FATAL: Semua level upsert gagal untuk clerkId:", clerkId);
    res.status(404).json({ error: "Kreator tidak ditemukan", clerkId });
    return;
  }


  const [followers] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.creatorClerkId, clerkId));

  res.json({
    clerkId,
    displayName: displayName ?? "Kreator Sineas",
    bio: user?.bio ?? null,
    avatarUrl: user?.avatarUrl ?? null,
    bannerUrl: user?.bannerUrl ?? null,
    createdAt: user?.createdAt?.toISOString() ?? null,
    videoCount,
    totalViews: stats?.views ?? 0,
    totalLikes: stats?.likes ?? 0,
    followerCount: followers?.count ?? 0,
  });
});

async function followStatus(creatorClerkId: string, viewerClerkId?: string) {
  const [followers] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.creatorClerkId, creatorClerkId));

  let isFollowing = false;
  if (viewerClerkId) {
    const [existing] = await db
      .select({ id: followsTable.id })
      .from(followsTable)
      .where(and(eq(followsTable.creatorClerkId, creatorClerkId), eq(followsTable.followerClerkId, viewerClerkId)));
    isFollowing = !!existing;
  }

  return { creatorId: creatorClerkId, followerCount: followers?.count ?? 0, isFollowing };
}

// GET /creators/:id/follow-status
router.get("/creators/:id/follow-status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const creatorClerkId = decodeURIComponent(raw);
  const viewerClerkId = (req as any).auth?.userId as string | undefined;
  res.json(await followStatus(creatorClerkId, viewerClerkId));
});

// POST /creators/:id/follow
router.post("/creators/:id/follow", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const creatorClerkId = decodeURIComponent(raw);
  const followerClerkId = (req as any).auth.userId as string;

  if (creatorClerkId === followerClerkId) {
    res.status(400).json({ error: "Tidak bisa mengikuti diri sendiri" });
    return;
  }

  const [existing] = await db
    .select({ id: followsTable.id })
    .from(followsTable)
    .where(and(eq(followsTable.creatorClerkId, creatorClerkId), eq(followsTable.followerClerkId, followerClerkId)));

  if (!existing) {
    await db
      .insert(followsTable)
      .values({ creatorClerkId, followerClerkId })
      .onConflictDoNothing();

    // Create follow notification
    try {
      const followerUser = await getOrCreateUser(followerClerkId);
      const followerName = followerUser?.displayName || "Seseorang";
      await db.insert(notificationsTable).values({
        userId: creatorClerkId,
        senderId: followerClerkId,
        type: "follow",
        message: `${followerName} mulai mengikuti Anda`,
        link: `/creator/${encodeURIComponent(followerClerkId)}`,
        read: false,
      });
    } catch (e) {
      console.error("Gagal membuat notifikasi follow:", e);
    }
  }

  res.json(await followStatus(creatorClerkId, followerClerkId));
});

// DELETE /creators/:id/follow
router.delete("/creators/:id/follow", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const creatorClerkId = decodeURIComponent(raw);
  const followerClerkId = (req as any).auth.userId as string;

  await db
    .delete(followsTable)
    .where(and(eq(followsTable.creatorClerkId, creatorClerkId), eq(followsTable.followerClerkId, followerClerkId)));

  res.json(await followStatus(creatorClerkId, followerClerkId));
});

// ── NEW SPECIFIED ENDPOINTS: /api/follow/:creatorId ───────────────────
// POST /api/follow/:creatorId
router.post("/follow/:creatorId", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.creatorId) ? req.params.creatorId[0] : req.params.creatorId;
  const creatorClerkId = decodeURIComponent(raw);
  const followerClerkId = (req as any).auth.userId as string;

  if (creatorClerkId === followerClerkId) {
    res.status(400).json({ error: "Tidak bisa mengikuti diri sendiri" });
    return;
  }

  const [existing] = await db
    .select({ id: followsTable.id })
    .from(followsTable)
    .where(and(eq(followsTable.creatorClerkId, creatorClerkId), eq(followsTable.followerClerkId, followerClerkId)));

  if (!existing) {
    await db
      .insert(followsTable)
      .values({ creatorClerkId, followerClerkId })
      .onConflictDoNothing();

    // Create follow notification
    try {
      const followerUser = await getOrCreateUser(followerClerkId);
      const followerName = followerUser?.displayName || "Seseorang";
      await db.insert(notificationsTable).values({
        userId: creatorClerkId,
        senderId: followerClerkId,
        type: "follow",
        message: `${followerName} mulai mengikuti Anda`,
        link: `/creator/${encodeURIComponent(followerClerkId)}`,
        read: false,
      });
    } catch (e) {
      console.error("Gagal membuat notifikasi follow:", e);
    }
  }

  res.json(await followStatus(creatorClerkId, followerClerkId));
});

// DELETE /api/follow/:creatorId
router.delete("/follow/:creatorId", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.creatorId) ? req.params.creatorId[0] : req.params.creatorId;
  const creatorClerkId = decodeURIComponent(raw);
  const followerClerkId = (req as any).auth.userId as string;

  await db
    .delete(followsTable)
    .where(and(eq(followsTable.creatorClerkId, creatorClerkId), eq(followsTable.followerClerkId, followerClerkId)));

  res.json(await followStatus(creatorClerkId, followerClerkId));
});

// GET /api/follow/:creatorId/status
router.get("/follow/:creatorId/status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.creatorId) ? req.params.creatorId[0] : req.params.creatorId;
  const creatorClerkId = decodeURIComponent(raw);
  const viewerClerkId = (req as any).auth?.userId as string | undefined;
  res.json(await followStatus(creatorClerkId, viewerClerkId));
});

// PATCH /api/user/profile
router.patch("/user/profile", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const { displayName, bio, avatarUrl, bannerUrl } = req.body;

  await getOrCreateUser(clerkId);
  const [user] = await db.update(usersTable)
    .set({
      displayName: displayName !== undefined ? displayName : undefined,
      bio: bio !== undefined ? bio : undefined,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
      bannerUrl: bannerUrl !== undefined ? bannerUrl : undefined,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.clerkId, clerkId))
    .returning();

  res.json({
    id: user.id,
    clerkId: user.clerkId,
    displayName: user.displayName,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    bannerUrl: user.bannerUrl ?? null,
    stripeCustomerId: user.stripeCustomerId ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});
// ──────────────────────────────────────────────────────────────────────

export { getOrCreateUser };
export default router;
