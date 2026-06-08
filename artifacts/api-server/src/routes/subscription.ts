import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateCheckoutBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

// Static plan definitions (IDR prices)
const PLANS = [
  {
    id: "basic",
    name: "Basic",
    priceId: "price_basic",
    amount: 19000,
    currency: "idr",
    interval: "month",
    tier: "basic",
    features: [
      "Resolusi HD 720p",
      "1 perangkat bersamaan",
      "Tanpa iklan",
      "Konten standar",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    priceId: "price_premium",
    amount: 65000,
    currency: "idr",
    interval: "month",
    tier: "premium",
    features: [
      "Resolusi Full HD 1080p",
      "2 perangkat bersamaan",
      "Tanpa iklan",
      "Download offline",
      "Konten eksklusif",
    ],
  },
  {
    id: "ultra",
    name: "Ultra",
    priceId: "price_ultra",
    amount: 120000,
    currency: "idr",
    interval: "month",
    tier: "ultra",
    features: [
      "Resolusi 4K Ultra HD",
      "4 perangkat bersamaan",
      "Tanpa iklan",
      "Download offline",
      "Semua konten eksklusif",
      "Prioritas dukungan",
    ],
  },
];

// GET /subscription/plans
router.get("/subscription/plans", async (req, res): Promise<void> => {
  // Try to get real Stripe plans if available
  try {
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();
    const prices = await stripe.prices.list({ active: true, expand: ["data.product"] });
    if (prices.data.length > 0) {
      const plans = prices.data.map(price => {
        const product = price.product as any;
        return {
          id: product.metadata?.tier ?? product.id,
          name: product.name,
          priceId: price.id,
          amount: price.unit_amount ?? 0,
          currency: price.currency,
          interval: price.recurring?.interval ?? "month",
          tier: product.metadata?.tier ?? "basic",
          features: product.metadata?.features ? JSON.parse(product.metadata.features) : [],
        };
      });
      res.json(plans);
      return;
    }
  } catch (err) {
    logger.warn({ err }, "Stripe not connected, using static plans");
  }
  res.json(PLANS);
});

// GET /subscription/status
router.get("/subscription/status", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));

  if (!user?.stripeCustomerId || !user?.stripeSubscriptionId) {
    res.json({ isSubscribed: false, plan: null, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false });
    return;
  }

  try {
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, { expand: ["items.data.price.product"] });
    const price = subscription.items.data[0]?.price;
    const product = price?.product as any;

    res.json({
      isSubscribed: subscription.status === "active",
      plan: product?.metadata?.tier ?? product?.name ?? null,
      status: subscription.status,
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to fetch subscription from Stripe");
    res.json({ isSubscribed: false, plan: null, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false });
  }
});

// POST /subscription/checkout
router.post("/subscription/checkout", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  const parsed = CreateCheckoutBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();

    let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
    if (!user) {
      [user] = await db.insert(usersTable).values({ clerkId, displayName: "Pengguna Sineas" }).returning();
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { clerkId } });
      customerId = customer.id;
      await db.update(usersTable).set({ stripeCustomerId: customerId }).where(eq(usersTable.clerkId, clerkId));
    }

    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: parsed.data.priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/subscription`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    logger.error({ err }, "Checkout session creation failed");
    res.status(503).json({ error: "Stripe tidak tersambung. Hubungkan Stripe di tab Integrations untuk mengaktifkan pembayaran." });
  }
});

// POST /subscription/portal
router.post("/subscription/portal", requireAuth, async (req, res): Promise<void> => {
  const clerkId = (req as any).auth.userId;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId));
    if (!user?.stripeCustomerId) {
      res.status(400).json({ error: "Tidak ada langganan aktif" });
      return;
    }
    const { getUncachableStripeClient } = await import("../stripeClient");
    const stripe = await getUncachableStripeClient();
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/subscription`,
    });
    res.json({ url: session.url });
  } catch (err: any) {
    logger.error({ err }, "Portal session creation failed");
    res.status(503).json({ error: "Stripe tidak tersambung." });
  }
});

export default router;
