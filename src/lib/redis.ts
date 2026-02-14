import Redis from "ioredis";

let client: Redis | null = null;
let disabled = false;

function getConfig(): { host: string; port: number; password?: string } | null {
  const host = process.env.REDIS_HOST;
  if (host && String(host).trim()) {
    return {
      host: String(host).trim(),
      port: parseInt(String(process.env.REDIS_PORT || "6379"), 10) || 6379,
      password: process.env.REDIS_PASSWORD?.trim() || undefined,
    };
  }
  return null;
}

export function getRedis(): Redis | null {
  if (disabled) return null;
  if (client) return client;
  const config = getConfig();
  if (!config) return null;
  try {
    client = new Redis({ ...config, lazyConnect: true, maxRetriesPerRequest: 2 });
    return client;
  } catch {
    disabled = true;
    return null;
  }
}

export function isRedisAvailable(): boolean {
  return getRedis() !== null && !disabled;
}
