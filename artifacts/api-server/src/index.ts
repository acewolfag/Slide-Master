import app from "./app";
import { logger } from "./lib/logger";
import { startSepayPoller } from "./lib/sepay";
import { startOrderSweeper } from "./lib/order-sweeper";

const rawPort = process.env["API_PORT"] ?? process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "API_PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid API_PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

const poller = startSepayPoller();
const sweeper = startOrderSweeper();

const shutdown = (signal: string) => {
  logger.info({ signal }, "Shutting down");
  poller?.stop();
  sweeper.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
