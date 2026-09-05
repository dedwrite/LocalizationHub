/** Fixed-window limiter with bounded memory, including clients seen only once. */
export function createRateLimiter({
  limit,
  windowMs,
  maxClients = 10_000,
  now = Date.now,
}) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    !Number.isFinite(windowMs) ||
    windowMs <= 0 ||
    !Number.isInteger(maxClients) ||
    maxClients < 1
  ) {
    throw new RangeError('Rate limiter settings must be positive.')
  }
  const clients = new Map()
  let nextCleanup = 0
  return {
    allow(key) {
      const time = now()
      if (time >= nextCleanup) {
        for (const [client, bucket] of clients) {
          if (time >= bucket.resetAt) clients.delete(client)
        }
        nextCleanup = time + windowMs
      }
      let bucket = clients.get(key)
      if (bucket && time >= bucket.resetAt) {
        clients.delete(key)
        bucket = undefined
      }
      if (!bucket) {
        // Do not evict active clients: eviction would reset their request limit.
        if (clients.size >= maxClients) return false
        bucket = { count: 0, resetAt: time + windowMs }
        clients.set(key, bucket)
      }
      if (bucket.count >= limit) return false
      bucket.count += 1
      return true
    },
  }
}
