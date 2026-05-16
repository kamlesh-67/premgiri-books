import type { Redis as UpstashRedis } from '@upstash/redis'
import type { Redis as IORedis } from 'ioredis'

type RedisClient = UpstashRedis | IORedis

let redisClient: RedisClient | null = null

export async function getRedis(): Promise<RedisClient> {
  if (redisClient) return redisClient

  if (process.env.REDIS_URL?.startsWith('redis://')) {
    // Local dev: plain TCP Redis (Docker container) via ioredis
    const ioredis = await import('ioredis')
    const Redis = ioredis.default ?? ioredis.Redis
    redisClient = new Redis(process.env.REDIS_URL)
  } else {
    // Staging/prod: Upstash Redis REST
    const { Redis } = await import('@upstash/redis')
    redisClient = Redis.fromEnv()
  }

  return redisClient
}

// ── Session cache utilities (used by Phase 9 RBAC) ────────────────────────────

export async function setCache<T>(key: string, value: T, expirySeconds: number): Promise<void> {
  const redis = await getRedis()
  const serialized = JSON.stringify(value)
  if (process.env.REDIS_URL?.startsWith('redis://')) {
    await (redis as IORedis).set(key, serialized, 'EX', expirySeconds)
  } else {
    await (redis as UpstashRedis).set(key, serialized, { ex: expirySeconds })
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  const redis = await getRedis()
  let value: string | null
  if (process.env.REDIS_URL?.startsWith('redis://')) {
    value = await (redis as IORedis).get(key)
  } else {
    value = await (redis as UpstashRedis).get<string>(key)
  }
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export async function deleteCache(key: string): Promise<void> {
  const redis = await getRedis()
  if (process.env.REDIS_URL?.startsWith('redis://')) {
    await (redis as IORedis).del(key)
  } else {
    await (redis as UpstashRedis).del(key)
  }
}

export async function invalidateUserSession(userId: string): Promise<void> {
  await deleteCache(`session:${userId}`)
}

// ── ADM-03: User blocklist (used by JWT callback to enforce instant revocation) ──

/**
 * Marks a user as blocked in Redis for the given TTL.
 * The JWT callback checks this key on every request — blocked users receive 401
 * on their next request within the TTL window.
 */
export async function blockUser(userId: string, ttlSeconds = 60): Promise<void> {
  await setCache(`blocked:${userId}`, '1', ttlSeconds)
}

/**
 * Returns true if the user has been blocked via blockUser() and the TTL has not expired.
 */
export async function isUserBlocked(userId: string): Promise<boolean> {
  const value = await getCache<string>(`blocked:${userId}`)
  return value !== null
}
