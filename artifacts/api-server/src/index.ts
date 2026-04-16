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
  }, 5000);
  forceExit.unref();
  server.close(() => {
    clearTimeout(forceExit);
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
