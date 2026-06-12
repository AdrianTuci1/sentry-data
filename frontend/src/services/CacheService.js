import { apiClient } from './ApiClient.js';

/**
 * CacheService — two-level caching for widget queries.
 *
 * Level 1 (this): in-memory Map, instant access, same-session only.
 * Level 2: GCS-backed, persisted across sessions, shared between users.
 *           Uses the backend /specs/cache endpoint as proxy to GCS.
 *
 * TTL is determined by the query's `refresh` field in the spec
 * (e.g. "30s", "60s", "5m"). Default: 60s.
 */

const memoryCache = new Map();

function parseTTL(refresh) {
  if (!refresh) return 60000; // default 60s
  const match = refresh.match(/^(\d+)(s|m|h)$/);
  if (!match) return 60000;
  const value = parseInt(match[1]);
  const unit = match[2];
  if (unit === 's') return value * 1000;
  if (unit === 'm') return value * 60000;
  if (unit === 'h') return value * 3600000;
  return 60000;
}

function makeKey(queryRef, sql) {
  // Simple hash for cache key
  let hash = 0;
  const str = `${queryRef}:${sql}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `${queryRef}_${Math.abs(hash)}`;
}

export const cacheService = {
  /**
   * Try to get data from in-memory cache.
   */
  getMemory(key, ttl) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttl) {
      memoryCache.delete(key);
      return null;
    }
    return entry.data;
  },

  /**
   * Store data in memory cache.
   */
  setMemory(key, data) {
    memoryCache.set(key, { data, timestamp: Date.now() });

    // Limit cache size to 200 entries
    if (memoryCache.size > 200) {
      const oldest = [...memoryCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) memoryCache.delete(oldest[0]);
    }
  },

  /**
   * Try to get data from GCS cache via backend proxy.
   */
  async getGCS(orgId, projectId, key) {
    try {
      const response = await apiClient.get(
        `/organizations/${orgId}/projects/${projectId}/specs/cache/${key}`
      );
      return response.data;
    } catch {
      return null;
    }
  },

  /**
   * Store data in GCS cache via backend proxy.
   */
  async setGCS(orgId, projectId, key, data, ttlMs) {
    try {
      await apiClient.post(
        `/organizations/${orgId}/projects/${projectId}/specs/cache`,
        { key, data, ttl: Math.round(ttlMs / 1000) }
      );
    } catch {
      // Cache write failure is non-critical
    }
  },

  /**
   * Execute query with two-level caching.
   *
   * @param {string} queryRef - widget query reference
   * @param {string} sql - full SQL query
   * @param {string} refresh - TTL string ("30s", "5m")
   * @param {string} orgId
   * @param {string} projectId
   * @param {Function} executeQuery - async () => data
   */
  async withCache(queryRef, sql, refresh, orgId, projectId, executeQuery) {
    const key = makeKey(queryRef, sql);
    const ttl = parseTTL(refresh);

    // Level 1: memory (instant)
    const memData = this.getMemory(key, ttl);
    if (memData) return memData;

    // Level 2: GCS (cross-session)
    if (orgId && projectId) {
      const gcsData = await this.getGCS(orgId, projectId, key);
      if (gcsData) {
        this.setMemory(key, gcsData);
        return gcsData;
      }
    }

    // Miss: execute query
    const data = await executeQuery();

    // Store in both caches
    this.setMemory(key, data);
    if (orgId && projectId) {
      this.setGCS(orgId, projectId, key, data, ttl).catch(() => {});
    }

    return data;
  },

  /**
   * Invalidate cache for a specific query.
   */
  invalidate(queryRef) {
    for (const [key] of memoryCache) {
      if (key.startsWith(`${queryRef}_`)) {
        memoryCache.delete(key);
      }
    }
  },

  /**
   * Clear all in-memory cache.
   */
  clear() {
    memoryCache.clear();
  },
};
