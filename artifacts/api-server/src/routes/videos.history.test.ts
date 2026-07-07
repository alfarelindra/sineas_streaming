import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { db, videosTable, watchProgressTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import videosRouter from "./videos";

// A dedicated clerk id so the suite never touches real user data.
const TEST_USER = `test-history-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

// The history page paginates with a default limit of 24, so seeding 30 rows
// guarantees the history spans more than one page.
const SEED_COUNT = 30;

let app: Express;
let videoIds: number[] = [];

function buildApp(): Express {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as any).auth = { userId: TEST_USER };
    next();
  });
  a.use("/api", videosRouter);
  return a;
}

async function seedProgressRows() {
  // Staggered timestamps so ordering (updatedAt DESC) is deterministic.
  const base = Date.now();
  const rows = videoIds.map((videoId, i) => ({
    userClerkId: TEST_USER,
    videoId,
    progressSeconds: (i + 1) * 7,
    progressPercent: Math.min(100, (i + 1) * 3),
    completed: i % 2 === 0,
    updatedAt: new Date(base - i * 60_000),
  }));
  await db.insert(watchProgressTable).values(rows);
}

beforeAll(async () => {
  app = buildApp();
  // Seed real videos so the history join surfaces every row.
  const inserted = await db
    .insert(videosTable)
    .values(
      Array.from({ length: SEED_COUNT }, (_, i) => ({
        title: `History Test Video ${i}`,
        uploaderClerkId: TEST_USER,
        uploaderName: "History Test",
        videoUrl: `https://example.com/history-test-${i}.mp4`,
        duration: 600,
        isPublic: true,
      })),
    )
    .returning({ id: videosTable.id });
  videoIds = inserted.map((r) => r.id);
});

afterAll(async () => {
  await db.delete(watchProgressTable).where(eq(watchProgressTable.userClerkId, TEST_USER));
  if (videoIds.length) {
    await db.delete(videosTable).where(inArray(videosTable.id, videoIds));
  }
});

beforeEach(async () => {
  await db.delete(watchProgressTable).where(eq(watchProgressTable.userClerkId, TEST_USER));
  await seedProgressRows();
});

describe("watch history clear + undo across pages", () => {
  it("history spans more than one page", async () => {
    const res = await request(app).get("/api/videos/history?page=1&limit=24");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(SEED_COUNT);
    expect(res.body.items).toHaveLength(24);

    const page2 = await request(app).get("/api/videos/history?page=2&limit=24");
    expect(page2.body.items).toHaveLength(SEED_COUNT - 24);
  });

  it("clearing returns snapshots for ALL rows, not just the visible page", async () => {
    const res = await request(app).delete("/api/videos/history");
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(SEED_COUNT);

    // History is now empty.
    const after = await request(app).get("/api/videos/history?page=1&limit=24");
    expect(after.body.total).toBe(0);
    expect(after.body.items).toHaveLength(0);
  });

  it("undo restores every row with preserved progress and ordering", async () => {
    // Snapshot the full pre-clear state directly from the DB.
    const beforeRows = await db
      .select()
      .from(watchProgressTable)
      .where(eq(watchProgressTable.userClerkId, TEST_USER));
    const beforeByVideo = new Map(beforeRows.map((r) => [r.videoId, r]));

    const cleared = await request(app).delete("/api/videos/history");
    expect(cleared.body.items).toHaveLength(SEED_COUNT);

    const restore = await request(app)
      .post("/api/videos/history/restore")
      .send({ items: cleared.body.items });
    expect(restore.status).toBe(204);

    // Every video is back with its exact progress fields.
    const restoredRows = await db
      .select()
      .from(watchProgressTable)
      .where(eq(watchProgressTable.userClerkId, TEST_USER));
    expect(restoredRows).toHaveLength(SEED_COUNT);

    for (const row of restoredRows) {
      const original = beforeByVideo.get(row.videoId);
      expect(original).toBeDefined();
      expect(row.progressSeconds).toBe(original!.progressSeconds);
      expect(row.progressPercent).toBe(original!.progressPercent);
      expect(row.completed).toBe(original!.completed);
      expect(row.updatedAt.getTime()).toBe(original!.updatedAt.getTime());
    }

    // Ordering (updatedAt DESC) is preserved across both pages of history.
    const p1 = await request(app).get("/api/videos/history?page=1&limit=24");
    const p2 = await request(app).get("/api/videos/history?page=2&limit=24");
    const watchedAts = [...p1.body.items, ...p2.body.items].map((i: any) =>
      new Date(i.watchedAt).getTime(),
    );
    expect(watchedAts).toHaveLength(SEED_COUNT);
    const sorted = [...watchedAts].sort((a, b) => b - a);
    expect(watchedAts).toEqual(sorted);
  });

  it("single-item remove + undo round-trips correctly", async () => {
    const targetId = videoIds[0];

    const removed = await request(app).delete(`/api/videos/${targetId}/watch`);
    expect(removed.status).toBe(200);
    expect(removed.body.videoId).toBe(targetId);

    // The row is gone.
    const goneRows = await db
      .select()
      .from(watchProgressTable)
      .where(eq(watchProgressTable.userClerkId, TEST_USER));
    expect(goneRows.find((r) => r.videoId === targetId)).toBeUndefined();
    expect(goneRows).toHaveLength(SEED_COUNT - 1);

    const restore = await request(app)
      .post("/api/videos/history/restore")
      .send({ items: [removed.body] });
    expect(restore.status).toBe(204);

    const restoredRows = await db
      .select()
      .from(watchProgressTable)
      .where(eq(watchProgressTable.userClerkId, TEST_USER));
    const back = restoredRows.find((r) => r.videoId === targetId);
    expect(back).toBeDefined();
    expect(back!.progressSeconds).toBe(removed.body.progressSeconds);
    expect(back!.progressPercent).toBe(removed.body.progressPercent);
    expect(back!.completed).toBe(removed.body.completed);
    expect(back!.updatedAt.getTime()).toBe(new Date(removed.body.watchedAt).getTime());
  });

  it("a malformed restore fails loudly (non-2xx) instead of silently losing data", async () => {
    const res = await request(app)
      .post("/api/videos/history/restore")
      .send({ items: [{ videoId: "not-a-number" }] });
    expect(res.status).toBe(400);
  });
});
