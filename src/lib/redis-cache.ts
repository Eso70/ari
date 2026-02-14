import { getRedis } from "@/lib/redis";

const PREFIX = "sarfr4z:";

export async function redisGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get(PREFIX + key);
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: string | object, ttlSeconds?: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const s = typeof value === "string" ? value : JSON.stringify(value);
    if (ttlSeconds != null && ttlSeconds > 0) {
      await redis.setex(PREFIX + key, ttlSeconds, s);
    } else {
      await redis.set(PREFIX + key, s);
    }
    return true;
  } catch {
    return false;
  }
}

export async function redisDel(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.del(PREFIX + key);
    return true;
  } catch {
    return false;
  }
}

export async function redisRpush(listKey: string, ...values: string[]): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    return await redis.rpush(PREFIX + listKey, ...values);
  } catch {
    return 0;
  }
}

export async function redisLrange(listKey: string, start: number, stop: number): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    return await redis.lrange(PREFIX + listKey, start, stop);
  } catch {
    return [];
  }
}

export async function redisLtrim(listKey: string, start: number, stop: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.ltrim(PREFIX + listKey, start, stop);
    return true;
  } catch {
    return false;
  }
}

export async function redisDelPattern(pattern: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  try {
    let deleted = 0;
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", PREFIX + pattern, "COUNT", 100);
      cursor = next;
      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== "0");
    return deleted;
  } catch {
    return 0;
  }
}
