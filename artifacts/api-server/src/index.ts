import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachWebSocket } from "./ws/roomManager";

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

const server = http.createServer(app);

attachWebSocket(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down server");
  const forceExit = setTimeout(() => {
    logger.warn("Force exiting after shutdown timeout");
    process.exit(0);
  }, 1500);
  forceExit.unref();
  // Force-close any keep-alive HTTP and WebSocket connections so the port
  // is released promptly. Without this, server.close() waits for clients
  // (e.g. open WS connections) to disconnect, which can hold the port long
  // enough that a workflow restart races into EADDRINUSE.
  try {
    (server as unknown as { closeAllConnections?: () => void })
      .closeAllConnections?.();
    (server as unknown as { closeIdleConnections?: () => void })
      .closeIdleConnections?.();
  } catch (err) {
    logger.warn({ err }, "Error closing connections during shutdown");
  }
  server.close(() => {
    clearTimeout(forceExit);
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
