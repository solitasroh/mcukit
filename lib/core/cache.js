/**
 * In-Memory Cache with TTL
 * @module lib/core/cache
 * @version 1.6.0
 */

/**
 * @typedef {Object} CacheEntry
 * @property {*} value
 * @property {number} timestamp
 */

/** @type {Map<string, CacheEntry>} */
const _store = new Map();

/** @type {number} */
const DEFAULT_TTL = 5000;

/**
 * 캐시에서 값 조회
 * @param {string} key
 * @param {number} [ttl=DEFAULT_TTL]
 * @returns {*|null}
 */
function get(key, ttl = DEFAULT_TTL) {
  const entry = _store.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > ttl) {
    _store.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * 캐시에 값 저장
 * @param {string} key
 * @param {*} value
 */
function set(key, value) {
  _store.set(key, {
    value,
    timestamp: Date.now(),
  });
}

/**
 * 캐시 무효화
 * @param {string|RegExp} keyOrPattern
 */
function invalidate(keyOrPattern) {
  if (typeof keyOrPattern === 'string') {
    _store.delete(keyOrPattern);
  } else if (keyOrPattern instanceof RegExp) {
    for (const key of _store.keys()) {
      if (keyOrPattern.test(key)) {
        _store.delete(key);
      }
    }
  }
}

/**
 * 캐시 전체 삭제
 */
function clear() {
  _store.clear();
}

/**
 * 글로벌 캐시 인스턴스
 */
const globalCache = { get, set, invalidate, clear };

/**
 * v1.6.0 ENH-91: ToolSearch result caching with fallback
 * CC v2.1.70 fixed ToolSearch empty response, but this adds defense-in-depth.
 */
const TOOLSEARCH_TTL = 60000; // 60s

/**
 * Get cached ToolSearch result
 * @param {string} query - Search query
 * @returns {*|null} Cached result or null
 */
function getToolSearchCache(query) {
  return get(`toolsearch:${query}`, TOOLSEARCH_TTL);
}

/**
 * Cache ToolSearch result (only non-empty results)
 * @param {string} query - Search query
 * @param {*} result - Search result
 */
function setToolSearchCache(query, result) {
  if (result && (Array.isArray(result) ? result.length > 0 : true)) {
    set(`toolsearch:${query}`, result);
  }
}

module.exports = {
  get,
  set,
  invalidate,
  clear,
  globalCache,
  DEFAULT_TTL,
  // v1.6.0 ENH-91: ToolSearch cache
  TOOLSEARCH_TTL,
  getToolSearchCache,
  setToolSearchCache,
  // Legacy compat
  _cache: globalCache,
};
