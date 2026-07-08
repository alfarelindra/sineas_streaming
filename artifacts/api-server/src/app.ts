import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy — before body parsers
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const isAllowed =
        origin.startsWith("http://localhost:") ||
        origin.includes("ngrok-free") ||
        origin.endsWith(".vercel.app") ||
        origin.includes("sineas-streaming");

      if (isAllowed || process.env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        callback(null, true); // Fallback to allow custom domains
      }
    },
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
    ],
  })
);

// Stripe webhook must be before express.json()
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing signature" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      const { WebhookHandlers } = await import("./webhookHandlers");
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err }, "Webhook processing failed");
      res.status(400).json({ error: err.message });
    }
  }
);

// Midtrans webhook — needs parsed JSON body (not raw buffer)
// Registered here for routing priority, actual handler is in routes/midtrans.ts
// No special body parsing needed: Midtrans sends standard JSON


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Resolve Clerk's legacy callable req.auth getter to its plain object value
app.use((req, res, next) => {
  if (typeof (req as any).auth === "function") {
    (req as any).auth = (req as any).auth();
  }
  next();
});

app.use("/api", router);

export default app;
