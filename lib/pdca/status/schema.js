/**
 * PDCA Status Schema + Migrations
 * @module lib/pdca/status/schema
 *
 * Extracted from lib/pdca/status.js (Cycle 2 G adopt — SQ-004 split).
 * Owns: createInitialStatusV2, migrateStatusToV2, migrateStatusV2toV3.
 */

let _core = null;
function getCore() {
  if (!_core) _core = require('../../core');
  return _core;
}

/**
 * v2.0 Schema: Default initial status
 * @returns {Object}
 */
function createInitialStatusV2() {
  const now = new Date().toISOString();
  return {
    version: "2.0",
    lastUpdated: now,
    activeFeatures: [],
    primaryFeature: null,
    features: {},
    pipeline: {
      currentPhase: 1,
      level: 'Dynamic',
      phaseHistory: []
    },
    session: {
      startedAt: now,
      onboardingCompleted: false,
      lastActivity: now
    },
    history: []
  };
}

/**
 * Migrate v1.0 schema to v2.0
 * @param {Object} oldStatus
 * @returns {Object}
 */
function migrateStatusToV2(oldStatus) {
  const { debugLog } = getCore();
  const now = new Date().toISOString();
  const newStatus = createInitialStatusV2();

  if (oldStatus.features) {
    newStatus.features = oldStatus.features;
    for (const [, feat] of Object.entries(newStatus.features)) {
      if (!feat.requirements) feat.requirements = [];
      if (!feat.documents) feat.documents = {};
      if (!feat.timestamps) {
        feat.timestamps = {
          started: feat.startedAt || now,
          lastUpdated: feat.updatedAt || now
        };
      }
    }
    newStatus.activeFeatures = Object.keys(newStatus.features).filter(
      f => newStatus.features[f].phase !== 'completed'
    );
  }

  if (oldStatus.currentFeature) {
    newStatus.primaryFeature = oldStatus.currentFeature;
    if (!newStatus.activeFeatures.includes(oldStatus.currentFeature)) {
      newStatus.activeFeatures.push(oldStatus.currentFeature);
    }
  }

  if (oldStatus.currentPhase) {
    newStatus.pipeline.currentPhase = oldStatus.currentPhase;
  }

  if (oldStatus.history) {
    newStatus.history = oldStatus.history;
  }

  newStatus.lastUpdated = now;
  newStatus.session.lastActivity = now;

  debugLog('PDCA', 'Migrated status from v1.0 to v2.0');
  return newStatus;
}

/**
 * Migrate v2.0 schema to v3.0
 * @param {Object} v2
 * @returns {Object}
 */
function migrateStatusV2toV3(v2) {
  if (v2.version === '3.0') return v2;

  const { debugLog } = getCore();
  const v3 = { ...v2, version: '3.0' };

  for (const [, feat] of Object.entries(v3.features || {})) {
    feat.stateMachine = feat.stateMachine || {
      currentState: feat.phase || 'idle',
      previousState: null,
      stateHistory: [],
      retryCount: 0,
      maxRetries: 5,
      circuitBreakerOpen: false,
    };
    feat.metrics = feat.metrics || {
      qualityScore: null,
      conventionCompliance: null,
      apiCompliance: null,
      cycleTimeMs: null,
      iterationEfficiency: null,
    };
    feat.phaseTimestamps = feat.phaseTimestamps || {};
    feat.automationLevel = feat.automationLevel || 2;
  }

  v3.stateMachine = v3.stateMachine || {
    defaultWorkflow: 'default',
    activeWorkflows: {},
    totalTransitions: 0,
  };
  let _ts = 40;
  try { _ts = require('../../control/trust-engine').getScore(); } catch (e) {
    getCore().debugLog('PDCA', 'Trust engine load failed, using default', { error: e.message });
  }
  v3.automation = v3.automation || {
    globalLevel: 2,
    trustScore: _ts,
    pendingApprovals: 0,
    lastGateResult: null,
  };
  v3.team = v3.team || {
    enabled: true,
    stateFile: '.rkit/runtime/agent-state.json',
    eventsFile: '.rkit/runtime/agent-events.jsonl',
  };

  debugLog('PDCA', 'Migrated status from v2.0 to v3.0');
  return v3;
}

module.exports = {
  createInitialStatusV2,
  migrateStatusToV2,
  migrateStatusV2toV3,
};
