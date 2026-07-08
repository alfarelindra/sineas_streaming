import { Router } from "express";
import { createHash } from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

const MIDTRANS_PLANS: Record<string, { name: string; amount: number }> = {
  basic:   { name: "Sineas Basic",   amount: 19000 },
  premium: { name: "Sineas Premium", amount: 65000 },
  ultra:   { name: "Sineas Ultra",   amount: 120000 },
};

const PLAN_DURATION_DAYS = 30;

function getMidtransConfig() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const baseUrl = isProduction
    ? "https://app.midtrans.com/snap/v1"
    : "https://app.sandbox.midtrans.com/snap/v1";
  return { serverKey, isProduction, baseUrl };
}

function isMidtransConfigured(): boolean {
  return !!process.env.MIDTRANS_SERVER_KEY;
}

function verifyMidtransSignature(orderId: string, statusCode: string, grossAmount: string, serverKey: string, receivedSignature: string): boolean {
  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const computed = createHash("sha512").update(raw).digest("hex");
  return computed === receivedSignature;
}

router.post("/midtrans/checkout", requireAuth, async (req, res): Promise<void> => {
  if (!isMidtransConfigured()) {
    res.status(503).json({ error: "Midtrans belum dikonfigurasi. Tambahkan MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY ke environment variables." });
    return;
  }
  const clerkId = (req as any).auth.userId;
  const { planId } = req.body;
    if (!planId || !MIDTRANS_PLANS[planId]) {
    res.status(400).json({ error: `Plan tidak valid. Pilih salah satu: ${Object.keys(MIDTRANS_PLANS).join(", ")}` });
    return;
  }
  const plan = MIDTRANS_PLANS[planId];
  const orderId = `sineas-${planId}-${clerkId.slice(-8)}-${Date.now()}`;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
  if (!user) { res.status(404).json({ error: "User tidak ditemukan" }); return; }
  const { serverKey, baseUrl } = getMidtransConfig();
  const snapPayload = {
    transaction_details: { order_id: orderId, gross_amount: plan.amount },
    item_details: [{ id: planId, price: plan.amount, quantity: 1, name: plan.name }],
    customer_details: { first_name: user.displayName ?? "Pengguna" },
    custom_field1: clerkId,
    custom_field2: planId,
  };
  try {
    const authHeader = "Basic " + Buffer.from(serverKey + ":").toString("base64");
    const response = await fetch(`${baseUrl}/transactions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(snapPayload) });
    if (!response.ok) { const errText = await response.text(); logger.error({ status: response.status, body: errText }, "Midtrans Snap API error"); res.status(502).json({ error: `Midtrans error: ${errText}` }); return; }
    const data = await response.json() as { token: string; redirect_url: string };
    logger.info({ orderId, planId }, "Midtrans Snap token created");
    res.json({ snapToken: data.token, redirectUrl: data.redirect_url, orderId, clientKey: process.env.MIDTRANS_CLIENT_KEY ?? "", isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true" });
  } catch (err: any) {
    logger.error({ err }, "Failed to create Midtrans transaction");
    res.status(500).json({ error: err.message || "Gagal menghubungi Midtrans" });
  }
});

router.post("/webhooks/midtrans", async (req, res): Promise<void> => {
  const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, custom_field1: clerkId, custom_field2: planId } = req.body;
  logger.info({ order_id, transaction_status, clerkId, planId }, "Midtrans webhook received");
  if (isMidtransConfigured()) {
    const { serverKey } = getMidtransConfig();
    const valid = verifyMidtransSignature(order_id, status_code, gross_amount, serverKey, signature_key);
    if (!valid) { logger.warn({ order_id }, "Midtrans webhook signature mismatch"); res.status(403).json({ error: "Invalid signature" }); return; }
  }
  if (!clerkId || !planId) { res.status(200).json({ received: true }); return; }
  try {
    const isSuccess = (transaction_status === "settlement" || transaction_status === "capture") && fraud_status !== "deny";
    const isPending = transaction_status === "pending";
    const isExpiredOrCancel = transaction_status === "expire" || transaction_status === "cancel" || transaction_status === "deny";
    if (isSuccess) {
      const expiredAt = new Date(); expiredAt.setDate(expiredAt.getDate() + PLAN_DURATION_DAYS);
      await db.update(usersTable).set({ subscriptionTier: planId, subscriptionStatus: "active", subscriptionExpiredAt: expiredAt, updatedAt: new Date() }).where(eq(usersTable.clerkId, clerkId));
      logger.info({ clerkId, planId, expiredAt }, "Subscription activated via Midtrans");
    } else if (isPending) {
      logger.info({ clerkId, planId, order_id }, "Payment pending");
    } else if (isExpiredOrCancel) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
      if (user?.subscriptionTier === planId && user?.subscriptionStatus === "active") {
        await db.update(usersTable).set({ subscriptionStatus: "expired", updatedAt: new Date() }).where(eq(usersTable.clerkId, clerkId));
        logger.info({ clerkId, planId }, "Subscription expired via Midtrans");
      }
    }
    res.status(200).json({ received: true });
  } catch (err: any) {
    logger.error({ err, order_id }, "Failed to process Midtrans webhook");
    res.status(500).json({ error: err.message });
  }
});

export default router;
