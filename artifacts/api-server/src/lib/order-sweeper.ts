/**
 * Background task: sweep pending orders past their `expiresAt` and mark them
 * `failed`. Runs every 5 minutes by default.
 */
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db";
import { and, eq, lt } from "drizzle-orm";
import { logger } from "./logger";

export interface SweeperHandle {
  stop: () => void;
}

export function startOrderSweeper(intervalMs = 5 * 60 * 1000): SweeperHandle {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async () => {
    if (stopped) return;
    try {
      const now = new Date();
      const result = await db
        .update(ordersTable)
        .set({ status: "failed" })
        .where(
          and(
            eq(ordersTable.status, "pending"),
            lt(ordersTable.expiresAt, now),
          ),
        )
        .returning({ id: ordersTable.id });
      if (result.length > 0) {
        logger.info(
          { count: result.length, ids: result.map((r) => r.id) },
          "Order sweeper: marked expired orders as failed",
        );
      }
    } catch (err) {
      logger.error({ err }, "Order sweeper tick failed");
    }
  };

  setTimeout(() => void tick(), 5_000);
  timer = setInterval(() => void tick(), intervalMs);
  logger.info({ intervalMs }, "Order sweeper started");

  return {
    stop: () => {
      stopped = true;
      if (timer) clearInterval(timer);
    },
  };
}
