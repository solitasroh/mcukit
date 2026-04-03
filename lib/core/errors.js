/**
 * McukitError - Standardized Error Class
 * @module lib/core/errors
 * @version 2.0.0
 *
 * Unified error handling with error codes, severity levels, and context.
 * Error code format: MCUKIT_{DOMAIN}_{DETAIL}
 */

// ============================================================
// Error Severity Levels
// ============================================================

/**
 * @typedef {'critical'|'error'|'warning'|'info'} ErrorSeverity
 */
const SEVERITY = {
  /** Immediate action required, workflow halted */
  CRITICAL: 'critical',
  /** Operation failed, fallback used */
  ERROR: 'error',
  /** Non-fatal issue, operation continues */
  WARNING: 'warning',
  /** Informational, logged only */
  INFO: 'info',
};

// ============================================================
// Error Codes by Domain
// ============================================================

const ERROR_CODES = {
  // PDCA Domain
  MCUKIT_PDCA_STATUS_READ: 'MCUKIT_PDCA_STATUS_READ',
  MCUKIT_PDCA_STATUS_WRITE: 'MCUKIT_PDCA_STATUS_WRITE',
  MCUKIT_PDCA_STATUS_MIGRATE: 'MCUKIT_PDCA_STATUS_MIGRATE',
  MCUKIT_PDCA_PHASE_INVALID: 'MCUKIT_PDCA_PHASE_INVALID',
  MCUKIT_PDCA_TRANSITION_FAIL: 'MCUKIT_PDCA_TRANSITION_FAIL',
  MCUKIT_PDCA_FEATURE_LIMIT: 'MCUKIT_PDCA_FEATURE_LIMIT',
  MCUKIT_PDCA_ITERATION_LIMIT: 'MCUKIT_PDCA_ITERATION_LIMIT',

  // State Domain
  MCUKIT_STATE_READ: 'MCUKIT_STATE_READ',
  MCUKIT_STATE_WRITE: 'MCUKIT_STATE_WRITE',
  MCUKIT_STATE_LOCK_TIMEOUT: 'MCUKIT_STATE_LOCK_TIMEOUT',
  MCUKIT_STATE_LOCK_STALE: 'MCUKIT_STATE_LOCK_STALE',
  MCUKIT_STATE_CORRUPT: 'MCUKIT_STATE_CORRUPT',
  MCUKIT_STATE_MIGRATION: 'MCUKIT_STATE_MIGRATION',

  // Hook Domain
  MCUKIT_HOOK_STDIN_PARSE: 'MCUKIT_HOOK_STDIN_PARSE',
  MCUKIT_HOOK_OUTPUT_FAIL: 'MCUKIT_HOOK_OUTPUT_FAIL',
  MCUKIT_HOOK_TIMEOUT: 'MCUKIT_HOOK_TIMEOUT',
  MCUKIT_HOOK_MODULE_LOAD: 'MCUKIT_HOOK_MODULE_LOAD',

  // Team Domain
  MCUKIT_TEAM_STATE_READ: 'MCUKIT_TEAM_STATE_READ',
  MCUKIT_TEAM_STATE_WRITE: 'MCUKIT_TEAM_STATE_WRITE',
  MCUKIT_TEAM_MAX_TEAMMATES: 'MCUKIT_TEAM_MAX_TEAMMATES',
  MCUKIT_TEAM_NOT_AVAILABLE: 'MCUKIT_TEAM_NOT_AVAILABLE',

  // Config Domain
  MCUKIT_CONFIG_LOAD: 'MCUKIT_CONFIG_LOAD',
  MCUKIT_CONFIG_PARSE: 'MCUKIT_CONFIG_PARSE',
  MCUKIT_CONFIG_MISSING: 'MCUKIT_CONFIG_MISSING',

  // Intent Domain
  MCUKIT_INTENT_DETECT: 'MCUKIT_INTENT_DETECT',
  MCUKIT_INTENT_AMBIGUOUS: 'MCUKIT_INTENT_AMBIGUOUS',

  // Plugin Domain
  MCUKIT_PLUGIN_DATA_BACKUP: 'MCUKIT_PLUGIN_DATA_BACKUP',
  MCUKIT_PLUGIN_DATA_RESTORE: 'MCUKIT_PLUGIN_DATA_RESTORE',
  MCUKIT_PLUGIN_INIT: 'MCUKIT_PLUGIN_INIT',
};

// ============================================================
// McukitError Class
// ============================================================

/**
 * Standardized rkit error with code, severity, and context.
 * @extends Error
 */
class McukitError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {Object} [options]
   * @param {string} [options.code='MCUKIT_UNKNOWN'] - Error code from ERROR_CODES
   * @param {ErrorSeverity} [options.severity='error'] - Severity level
   * @param {Error} [options.cause] - Original error that caused this
   * @param {Object} [options.context] - Additional context (file path, feature name, etc.)
   */
  constructor(message, { code, severity, cause, context } = {}) {
    super(message);
    this.name = 'McukitError';
    this.code = code || 'MCUKIT_UNKNOWN';
    this.severity = severity || SEVERITY.ERROR;
    this.cause = cause || null;
    this.context = context || {};
    this.timestamp = new Date().toISOString();
  }

  /**
   * Convert to JSON-safe object for logging/serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      severity: this.severity,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      cause: this.cause
        ? { name: this.cause.name, message: this.cause.message, code: this.cause.code }
        : null,
    };
  }

  /**
   * Check if this is a critical error requiring workflow halt
   * @returns {boolean}
   */
  isCritical() {
    return this.severity === SEVERITY.CRITICAL;
  }

  /**
   * Format for debug log output
   * @returns {string}
   */
  toDebugString() {
    const causePart = this.cause ? ` (caused by: ${this.cause.message})` : '';
    return `[${this.code}] ${this.message}${causePart}`;
  }
}

// ============================================================
// Helper: Safe Catch Wrapper
// ============================================================

/**
 * Wrap a synchronous function call with standardized error handling.
 * On error, logs via debugLog (if available) and returns fallback.
 *
 * @param {Function} fn - Synchronous function to execute
 * @param {*} fallback - Fallback value returned on error
 * @param {Object} [context] - Error context options
 * @param {string} [context.code] - Error code for wrapping
 * @param {string} [context.module='rkit'] - Module name for debug logging
 * @returns {*} Function result or fallback value
 */
function safeCatch(fn, fallback, context) {
  const { code, module: mod } = context || {};
  try {
    return fn();
  } catch (e) {
    const rkitError =
      e instanceof McukitError
        ? e
        : new McukitError(e.message, {
            code: code || 'MCUKIT_UNKNOWN',
            severity: SEVERITY.WARNING,
            cause: e,
          });

    // Log via debugLog if available (lazy require to avoid circular deps)
    try {
      const { debugLog } = require('./debug');
      debugLog(mod || 'rkit', rkitError.toDebugString(), rkitError.context);
    } catch (_) {
      // Debug module unavailable — silently ignore
    }

    return fallback;
  }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  McukitError,
  ERROR_CODES,
  SEVERITY,
  safeCatch,
};
