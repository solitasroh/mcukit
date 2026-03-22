/**
 * Circuit Breaker Pattern for PDCA Error Recovery
 * @module lib/pdca/circuit-breaker
 * @version 2.0.0
 *
 * States:
 * - CLOSED: Normal operation. Failure count accumulates.
 * - OPEN: Blocked. All PDCA transitions rejected. Cooldown waiting.
 * - HALF_OPEN: Trial. 1 attempt allowed; result decides CLOSED or OPEN.
 *
 * In-memory only (resets on session start).
 */

// Lazy require
let _core = null;
function getCore() {
  if (!_core) { _core = require('../core'); }
  return _core;
}

/** @type {number} Default failure threshold before opening circuit */
const DEFAULT_FAILURE_THRESHOLD = 3;

/** @type {number} Default cooldown in ms (30 seconds) */
const DEFAULT_COOLDOWN_MS = 30000;

/**
 * In-memory circuit breaker state per feature
 * @type {Map<string, Object>}
 */
const circuits = new Map();

/**
 * Create a fresh circuit breaker state for a feature
 * @param {string} feature - Feature name
 * @returns {Object} Initial circuit state
 */
function createCircuitState(feature) {
  return {
    state: 'closed',
    feature,
    failureCount: 0,
    failureThreshold: DEFAULT_FAILURE_THRESHOLD,
    cooldownMs: DEFAULT_COOLDOWN_MS,
    lastFailureAt: 0,
    openedAt: 0,
    lastError: null,
  };
}

/**
 * Get or create circuit breaker state for a feature
 * @param {string} feature - Feature name
 * @returns {{ state: string, feature: string, failureCount: number, failureThreshold: number, cooldownMs: number, lastFailureAt: number, openedAt: number, lastError: string|null }}
 */
function getState(feature) {
  if (!circuits.has(feature)) {
    circuits.set(feature, createCircuitState(feature));
  }
  const circuit = circuits.get(feature);

  // Auto-transition from OPEN to HALF_OPEN after cooldown
  if (circuit.state === 'open' && circuit.openedAt > 0) {
    const elapsed = Date.now() - circuit.openedAt;
    if (elapsed >= circuit.cooldownMs) {
      circuit.state = 'half_open';
    }
  }

  return { ...circuit };
}

/**
 * Record a failure for a feature
 * @param {string} feature - Feature name
 * @param {string} error - Error message
 * @returns {{ state: string, failureCount: number, shouldRetry: boolean }}
 */
function recordFailure(feature, error) {
  const { debugLog } = getCore();

  if (!circuits.has(feature)) {
    circuits.set(feature, createCircuitState(feature));
  }
  const circuit = circuits.get(feature);

  circuit.failureCount++;
  circuit.lastFailureAt = Date.now();
  circuit.lastError = error || 'Unknown error';

  if (circuit.state === 'half_open') {
    // Failed during trial — reopen
    circuit.state = 'open';
    circuit.openedAt = Date.now();
    debugLog('PDCA', `Circuit HALF_OPEN -> OPEN for ${feature}`, { error });
  } else if (circuit.failureCount >= circuit.failureThreshold) {
    // Threshold reached — open circuit
    circuit.state = 'open';
    circuit.openedAt = Date.now();
    debugLog('PDCA', `Circuit CLOSED -> OPEN for ${feature}`, {
      failureCount: circuit.failureCount,
      error,
    });
  }

  return {
    state: circuit.state,
    failureCount: circuit.failureCount,
    shouldRetry: circuit.state !== 'open',
  };
}

/**
 * Record a success for a feature, resetting the circuit breaker
 * @param {string} feature - Feature name
 * @returns {void}
 */
function recordSuccess(feature) {
  const { debugLog } = getCore();

  if (!circuits.has(feature)) return;

  const circuit = circuits.get(feature);
  const previousState = circuit.state;

  circuit.state = 'closed';
  circuit.failureCount = 0;
  circuit.lastError = null;
  circuit.openedAt = 0;

  if (previousState !== 'closed') {
    debugLog('PDCA', `Circuit ${previousState.toUpperCase()} -> CLOSED for ${feature}`);
  }
}

/**
 * Check if the circuit is currently open (blocking)
 * @param {string} feature - Feature name
 * @returns {boolean} True if circuit is open and blocking
 */
function isOpen(feature) {
  const state = getState(feature);
  return state.state === 'open';
}

/**
 * Check if a retry/transition is allowed for the feature
 * @param {string} feature - Feature name
 * @returns {boolean} True if allowed (closed or half_open)
 */
function allowRetry(feature) {
  const state = getState(feature);
  return state.state === 'closed' || state.state === 'half_open';
}

/**
 * Check if proceeding is allowed, with detailed reason
 * @param {string} feature - Feature name
 * @returns {{ allowed: boolean, state: string, reason: string }}
 */
function canProceed(feature) {
  const state = getState(feature);

  if (state.state === 'closed') {
    return { allowed: true, state: 'closed', reason: 'Circuit is closed, normal operation' };
  }

  if (state.state === 'half_open') {
    return { allowed: true, state: 'half_open', reason: 'Circuit is half-open, trial attempt allowed' };
  }

  // OPEN
  const remaining = Math.max(0, state.cooldownMs - (Date.now() - state.openedAt));
  return {
    allowed: false,
    state: 'open',
    reason: `Circuit is open. ${Math.ceil(remaining / 1000)}s cooldown remaining. Last error: ${state.lastError}`,
  };
}

/**
 * Force reset the circuit breaker for a feature
 * @param {string} feature - Feature name
 * @returns {void}
 */
function reset(feature) {
  const { debugLog } = getCore();
  circuits.set(feature, createCircuitState(feature));
  debugLog('PDCA', `Circuit breaker reset for ${feature}`);
}

module.exports = {
  getState,
  recordFailure,
  recordSuccess,
  isOpen,
  allowRetry,
  canProceed,
  reset,
};
