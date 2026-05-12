/**
 * StateStorePort — Type-only Port for persistent state IO.
 *
 * rkit Cycle 2 candidate B partial_adopt. Sourced from bkit
 * lib/domain/ports/state-store.port.js. Type-only contract — no runtime
 * behavior. Implementations live in rkit lib/core/state-store.js.
 *
 * Council code-analyzer evidence: ISP +3 (segregated narrow interface
 * for state IO). DIP improvement when rkit lib/audit/ + lib/quality/ adopt
 * this port for dependency inversion.
 *
 * @module lib/domain/ports/state-store
 */

/**
 * @typedef {Object} StateStorePort
 * @property {(key: string) => Promise<any>} load - Load arbitrary JSON-serializable state
 * @property {(key: string, val: any) => Promise<void>} save - Persist state (atomic write preferred)
 * @property {(key: string) => Promise<void>} lock - Acquire lock for fingerprint dedup
 * @property {(key: string) => Promise<void>} unlock - Release lock
 */

module.exports = {};
