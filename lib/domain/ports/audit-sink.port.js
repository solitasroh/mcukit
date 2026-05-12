/**
 * AuditSinkPort — Type-only Port for audit event emission.
 *
 * rkit Cycle 2 candidate B partial_adopt. Sourced from bkit
 * lib/domain/ports/audit-sink.port.js. Type-only contract — no runtime
 * behavior. Implementations live in rkit lib/audit/audit-logger.js.
 *
 * Single-sink only (file-based). bkit's OTEL dual-sink (ENH-259) deferred
 * to cycle 3+ (Cycle 2 candidate F P2). cc-regression integration (ENH-258)
 * deferred to Cycle 2 candidate E adopt decision.
 *
 * @module lib/domain/ports/audit-sink
 */

/**
 * @typedef {Object} AuditEvent
 * @property {string} type - Event type (e.g. "permission.granted", "policy.violation")
 * @property {string} [id] - Entity ID
 * @property {string} [category] - Event category (matches audit-logger CATEGORIES enum)
 * @property {Object} [meta] - Structured metadata (sanitizeDetails applied per Cycle 1 v2.1.10)
 */

/**
 * @typedef {Object} AuditSinkPort
 * @property {(event: AuditEvent) => Promise<void>} emit
 */

module.exports = {};
