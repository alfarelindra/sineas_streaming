import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = (req as any).auth;
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Attach DB user for convenience
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth.userId));
  (req as any).dbUser = user ?? null;

  next();
}
