import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /notifications
router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId as string;

  try {
    const notifs = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, clerkId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    res.json(notifs.map(n => ({
      id: String(n.id),
      type: n.type,
      message: n.message,
      time: n.createdAt.toISOString(),
      read: n.read,
      link: n.link || undefined
    })));
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil notifikasi" });
  }
});

// POST /notifications/read-all
router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId as string;

  try {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userId, clerkId));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal menandai semua notifikasi dibaca" });
  }
});

export default router;
