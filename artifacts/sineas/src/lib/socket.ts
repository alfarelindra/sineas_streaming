import { io } from "socket.io-client";

// Connect to backend API server (port 8080 in dev, or local origin in prod)
const socketUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV
  ? "http://localhost:8080"
  : window.location.origin);

export const socket = io(socketUrl, {
  autoConnect: true,
  transports: ["websocket"],
});
