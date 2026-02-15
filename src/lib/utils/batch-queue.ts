/**
 * Batch queue for analytics: views and clicks.
 * API only pushes to Redis (no direct DB writes). This module flushes Redis → DB
 * in batches (insertPageViewsBatch / insertLinkClicksBatch) on an interval.
 * Uniqueness for reporting is done in SQL (COUNT(DISTINCT ip_address)).
 */

import { insertPageViewsBatch, insertLinkClicksBatch } from "@/lib/db/queries";
import { redisRpush, redisLrange, redisLtrim } from "@/lib/redis-cache";

const REDIS_VIEWS = "analytics:queue:views";
const REDIS_CLICKS = "analytics:queue:clicks";
const FLUSH_INTERVAL_MS = 30000; // 30 seconds - standard interval for fresh data
const BATCH_SIZE = 1000;

interface ViewRecord {
  linktree_id: string;
  ip_address: string;
  session_id: string | null;
  viewed_at?: string;
}

interface ClickRecord {
  link_id: string;
  linktree_id: string;
  ip_address: string;
  session_id: string | null;
  clicked_at?: string;
}

let globalFlushInterval: NodeJS.Timeout | null = null;

async function flushQueuesToDb(): Promise<void> {
  if (typeof window !== "undefined") return;
  // Drain Redis views
  const viewJsons = await redisLrange(REDIS_VIEWS, 0, BATCH_SIZE - 1);
  if (viewJsons.length > 0) {
    const items = viewJsons
      .map((s) => {
        try {
          return JSON.parse(s) as ViewRecord;
        } catch {
          return null;
        }
      })
      .filter((i): i is ViewRecord => !!i?.linktree_id?.trim() && !!i?.ip_address?.trim());
    if (items.length) {
      try {
        await insertPageViewsBatch(items);
      } catch (e) {
        if ((e as { code?: string })?.code !== "23505") throw e;
      }
    }
    await redisLtrim(REDIS_VIEWS, viewJsons.length, -1);
  }
  // Drain Redis clicks
  const clickJsons = await redisLrange(REDIS_CLICKS, 0, BATCH_SIZE - 1);
  if (clickJsons.length > 0) {
    const items = clickJsons
      .map((s) => {
        try {
          return JSON.parse(s) as ClickRecord;
        } catch {
          return null;
        }
      })
      .filter(
        (i): i is ClickRecord =>
          !!i?.link_id?.trim() && !!i?.linktree_id?.trim() && !!i?.ip_address?.trim()
      );
    if (items.length) {
      try {
        await insertLinkClicksBatch(items);
      } catch (e) {
        if ((e as { code?: string })?.code !== "23505") throw e;
      }
    }
    await redisLtrim(REDIS_CLICKS, clickJsons.length, -1);
  }
}

function startGlobalFlushInterval(): void {
  if (typeof window !== "undefined" || globalFlushInterval) return;
  globalFlushInterval = setInterval(() => {
    flushQueuesToDb().catch((err) => console.error("Analytics flush error:", err));
  }, FLUSH_INTERVAL_MS);
}

export async function addView(view: ViewRecord): Promise<void> {
  if (!view?.linktree_id?.trim() || !view?.ip_address?.trim()) return;
  if (typeof window !== "undefined") return;
  await redisRpush(REDIS_VIEWS, JSON.stringify(view));
}

export async function addClick(click: ClickRecord): Promise<void> {
  if (
    !click?.link_id?.trim() ||
    !click?.linktree_id?.trim() ||
    !click?.ip_address?.trim()
  )
    return;
  if (typeof window !== "undefined") return;
  await redisRpush(REDIS_CLICKS, JSON.stringify(click));
}

export async function flushAllQueues(): Promise<void> {
  if (typeof window !== "undefined") return;
  await flushQueuesToDb();
}

if (typeof process !== "undefined") {
  const onShutdown = async () => {
    await flushQueuesToDb();
    if (globalFlushInterval) {
      clearInterval(globalFlushInterval);
      globalFlushInterval = null;
    }
  };
  process.on("SIGTERM", () => {
    onShutdown().finally(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    onShutdown().finally(() => process.exit(0));
  });
}

if (typeof window === "undefined") {
  startGlobalFlushInterval();
}
