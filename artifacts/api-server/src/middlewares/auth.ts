import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/express";

/**
 * Requires a valid Clerk session.
 * Also ensures a matching row exists in the `users` table and attaches it
 * as `req.dbUser` so downstream route handlers always have a resolved display name.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = (req as any).auth;
  console.log("[DEBUG] requireAuth headers:", req.headers);
  console.log("[DEBUG] requireAuth auth object:", auth);
  if (!auth?.userId) {
    console.warn("[DEBUG] requireAuth unauthorized: missing auth.userId");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Look up user; create a stub row if this is the first authenticated request.
  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth.userId));
  if (!user) {
    let derivedName = "Pengguna Sineas";
    let avatarUrl: string | null = null;
    try {
      const clerkUser = await clerkClient.users.getUser(auth.userId);
      derivedName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()
        || clerkUser.username
        || clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0]
        || "Pengguna Sineas";
      avatarUrl = clerkUser.imageUrl || null;
    } catch (err) {
      console.error("Gagal mengambil detail user dari Clerk di middleware requireAuth:", err);
      const claims = auth.sessionClaims ?? {};
      const firstName: string = claims.first_name ?? claims.given_name ?? "";
      const lastName: string = claims.last_name ?? claims.family_name ?? "";
      const email: string = claims.email ?? "";
      derivedName = [firstName, lastName].filter(Boolean).join(" ").trim()
        || email.split("@")[0]
        || "Pengguna Sineas";
    }

    [user] = await db.insert(usersTable)
      .values({
        clerkId: auth.userId,
        displayName: derivedName,
        avatarUrl: avatarUrl,
      })
      .onConflictDoNothing()
      .returning();

    // Race condition: another request may have inserted first — re-fetch.
    if (!user) {
      [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth.userId));
    }
  } else if (!user.avatarUrl || user.displayName === "Pengguna Sineas") {
    // Also auto-sync on request if missing details
    try {
      const clerkUser = await clerkClient.users.getUser(auth.userId);
      const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()
        || clerkUser.username
        || clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0]
        || "Pengguna Sineas";
      const avatar = clerkUser.imageUrl || null;

      const [updated] = await db.update(usersTable)
        .set({
          displayName: user.displayName === "Pengguna Sineas" ? name : user.displayName,
          avatarUrl: user.avatarUrl ? user.avatarUrl : avatar,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.clerkId, auth.userId))
        .returning();
      user = updated;
    } catch (err) {
      console.error("Gagal sync detail user dari Clerk di middleware requireAuth:", err);
    }
  }

  (req as any).dbUser = user ?? null;
  next();
}
