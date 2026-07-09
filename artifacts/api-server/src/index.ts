import app from "./app";
import { logger } from "./lib/logger";
import { createServer } from "http";
import { Server } from "socket.io";
import { ensureBucketExists, SUPABASE_BUCKET } from "./lib/supabase";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  try {
    const { runMigrations } = await import("stripe-replit-sync");
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return;

    await runMigrations({ databaseUrl });

    const { getStripeSync } = await import("./stripeClient");
    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    await stripeSync.syncBackfill();
    logger.info("Stripe initialized successfully");
  } catch (err) {
    logger.warn({ err }, "Stripe initialization skipped (not connected)");
  }
}

// Create HTTP server wrapping the Express app
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Client connected to WebSocket");

  // Broadcast current global active users count to all clients
  io.emit("global-active-count", io.engine.clientsCount);

  // Handle joining specific video watch room
  socket.on("join-video-room", (videoId: string) => {
    // Leave previous room if any
    const prevRoom = (socket as any).currentVideoRoom;
    if (prevRoom) {
      socket.leave(prevRoom);
      const prevSize = io.sockets.adapter.rooms.get(prevRoom)?.size ?? 0;
      io.to(prevRoom).emit("video-room-count", { videoId: prevRoom, count: prevSize });
    }

    // Join new room
    socket.join(videoId);
    (socket as any).currentVideoRoom = videoId;
    
    // Get room size and broadcast
    const size = io.sockets.adapter.rooms.get(videoId)?.size ?? 0;
    io.to(videoId).emit("video-room-count", { videoId, count: size });
    logger.info({ socketId: socket.id, videoId, size }, "Client joined video watch room");
  });

  socket.on("disconnecting", () => {
    // Notify rooms the client is leaving
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        const size = io.sockets.adapter.rooms.get(room)?.size ?? 0;
        io.to(room).emit("video-room-count", { videoId: room, count: Math.max(0, size - 1) });
      }
    }
  });

  socket.on("disconnect", () => {
    // Broadcast updated global active users count
    io.emit("global-active-count", io.engine.clientsCount);
    logger.info({ socketId: socket.id }, "Client disconnected from WebSocket");
  });
});

httpServer.listen(port, async (err?: any) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await ensureBucketExists(); // Uses SUPABASE_BUCKET_NAME env var (default: sineas-videos)
  logger.info({ bucket: SUPABASE_BUCKET }, "Supabase bucket ready");
  await initStripe();
});
