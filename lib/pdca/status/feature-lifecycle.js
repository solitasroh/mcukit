/**
 * PDCA Feature Lifecycle (CRUD + cleanup + limit enforcement)
 * @module lib/pdca/status/feature-lifecycle
 *
 * Extracted from lib/pdca/status.js (Cycle 2 G adopt — SQ-004 split).
 * Owns: feature add/update/remove/delete/complete/switch + archive summary + auto-cleanup.
 */

let _core = null;
function getCore() {
  if (!_core) _core = require('../../core');
  return _core;
}

let _phase = null;
function getPhase() {
  if (!_phase) _phase = require('../phase');
  return _phase;
}

const {
  getPdcaStatusFull,
  savePdcaStatus,
} = require('./store');
const { createInitialStatusV2 } = require('./schema');

function getFeatureStatus(feature) {
  const status = getPdcaStatusFull();
  return status?.features?.[feature] || null;
}

function updatePdcaStatus(feature, phase, data = {}) {
  const { debugLog } = getCore();
  const { getPhaseNumber } = getPhase();

  let status = getPdcaStatusFull(true) || createInitialStatusV2();

  if (!status.features[feature]) {
    status.features[feature] = {
      phase: phase,
      phaseNumber: getPhaseNumber(phase),
      matchRate: null,
      iterationCount: 0,
      requirements: [],
      documents: {},
      timestamps: { started: new Date().toISOString() }
    };
  }

  Object.assign(status.features[feature], {
    phase,
    phaseNumber: getPhaseNumber(phase),
    ...data,
    timestamps: {
      ...status.features[feature].timestamps,
      lastUpdated: new Date().toISOString()
    }
  });

  if (!status.activeFeatures.includes(feature)) {
    status.activeFeatures.push(feature);
  }

  if (!status.primaryFeature) {
    status.primaryFeature = feature;
  }

  status.history.push({
    timestamp: new Date().toISOString(),
    feature,
    phase,
    action: 'updated'
  });

  savePdcaStatus(status);
  debugLog('PDCA', `Updated ${feature} to ${phase}`, data);
}

function addPdcaHistory(entry) {
  const status = getPdcaStatusFull(true);
  if (!status) return;

  status.history.push({
    timestamp: new Date().toISOString(),
    ...entry
  });

  if (status.history.length > 100) {
    status.history = status.history.slice(-100);
  }

  savePdcaStatus(status);
}

function completePdcaFeature(feature) {
  updatePdcaStatus(feature, 'completed', {
    timestamps: {
      completed: new Date().toISOString()
    }
  });
}

function setActiveFeature(feature) {
  const { debugLog } = getCore();
  const status = getPdcaStatusFull(true);
  if (!status) return;

  status.primaryFeature = feature;
  if (!status.activeFeatures.includes(feature)) {
    status.activeFeatures.push(feature);
  }

  savePdcaStatus(status);
  debugLog('PDCA', 'Set active feature', { feature });
}

function addActiveFeature(feature, setAsPrimary = false) {
  const status = getPdcaStatusFull(true);
  if (!status) return;

  if (!status.activeFeatures.includes(feature)) {
    status.activeFeatures.push(feature);
  }
  if (setAsPrimary) {
    status.primaryFeature = feature;
  }

  savePdcaStatus(status);
}

function removeActiveFeature(feature) {
  const status = getPdcaStatusFull(true);
  if (!status) return;

  status.activeFeatures = status.activeFeatures.filter(f => f !== feature);
  if (status.primaryFeature === feature) {
    status.primaryFeature = status.activeFeatures[0] || null;
  }

  savePdcaStatus(status);
}

function deleteFeatureFromStatus(feature) {
  const { debugLog } = getCore();
  const status = getPdcaStatusFull(true);

  if (!status) return { success: false, reason: 'Status not found' };
  if (!status.features[feature]) return { success: false, reason: 'Feature not found' };

  const featureStatus = status.features[feature];
  if (status.activeFeatures.includes(feature) &&
      featureStatus.phase !== 'archived' &&
      featureStatus.phase !== 'completed') {
    return { success: false, reason: 'Cannot delete active feature' };
  }

  delete status.features[feature];
  status.activeFeatures = status.activeFeatures.filter(f => f !== feature);
  if (status.primaryFeature === feature) {
    status.primaryFeature = status.activeFeatures[0] || null;
  }

  status.history.push({
    timestamp: new Date().toISOString(),
    action: 'feature_deleted',
    feature: feature
  });
  if (status.history.length > 100) {
    status.history = status.history.slice(-100);
  }

  savePdcaStatus(status);
  debugLog('PDCA', `Feature deleted: ${feature}`);
  return { success: true, deletedFeature: feature };
}

function enforceFeatureLimit(maxFeatures = 50) {
  const { debugLog } = getCore();
  const status = getPdcaStatusFull(true);

  if (!status) {
    return { success: false, deletedCount: 0, deleted: [], remaining: 0 };
  }

  const featureNames = Object.keys(status.features);
  const featureCount = featureNames.length;
  if (featureCount <= maxFeatures) {
    return { success: true, deletedCount: 0, deleted: [], remaining: featureCount };
  }

  const archived = Object.entries(status.features)
    .filter(([, f]) => f.phase === 'archived' || f.phase === 'completed')
    .sort((a, b) => {
      const dateA = new Date(a[1].timestamps?.archivedAt || a[1].timestamps?.lastUpdated || 0);
      const dateB = new Date(b[1].timestamps?.archivedAt || b[1].timestamps?.lastUpdated || 0);
      return dateA - dateB;
    });

  const toDeleteCount = featureCount - maxFeatures;
  const deleted = [];
  for (let i = 0; i < Math.min(toDeleteCount, archived.length); i++) {
    const featureName = archived[i][0];
    delete status.features[featureName];
    status.activeFeatures = status.activeFeatures.filter(f => f !== featureName);
    deleted.push(featureName);
  }

  if (deleted.length === 0) {
    debugLog('PDCA', 'Feature limit exceeded but no archived features to delete');
    return {
      success: true,
      deletedCount: 0,
      deleted: [],
      remaining: Object.keys(status.features).length
    };
  }

  status.history.push({
    timestamp: new Date().toISOString(),
    action: 'auto_cleanup',
    deletedCount: deleted.length,
    deleted: deleted
  });
  if (status.history.length > 100) {
    status.history = status.history.slice(-100);
  }
  if (deleted.includes(status.primaryFeature)) {
    status.primaryFeature = status.activeFeatures[0] || null;
  }

  savePdcaStatus(status);
  debugLog('PDCA', `Auto cleanup: deleted ${deleted.length} features`, { deleted });
  return {
    success: true,
    deletedCount: deleted.length,
    deleted,
    remaining: Object.keys(status.features).length
  };
}

function getArchivedFeatures() {
  const status = getPdcaStatusFull();
  if (!status) return [];

  return Object.entries(status.features)
    .filter(([, f]) => f.phase === 'archived' || f.phase === 'completed')
    .map(([name]) => name);
}

function cleanupArchivedFeatures(features = null) {
  const { debugLog } = getCore();
  const status = getPdcaStatusFull(true);

  if (!status) {
    return { success: false, deletedCount: 0, deleted: [], remaining: 0 };
  }

  const targets = features || getArchivedFeatures();
  const deleted = [];
  for (const feature of targets) {
    const featureStatus = status.features[feature];
    if (!featureStatus ||
        (featureStatus.phase !== 'archived' && featureStatus.phase !== 'completed')) {
      continue;
    }
    delete status.features[feature];
    status.activeFeatures = status.activeFeatures.filter(f => f !== feature);
    deleted.push(feature);
  }

  if (deleted.length === 0) {
    return {
      success: true,
      deletedCount: 0,
      deleted: [],
      remaining: Object.keys(status.features).length
    };
  }

  status.history.push({
    timestamp: new Date().toISOString(),
    action: 'feature_deleted',
    deletedCount: deleted.length,
    deleted: deleted
  });
  if (status.history.length > 100) {
    status.history = status.history.slice(-100);
  }
  if (deleted.includes(status.primaryFeature)) {
    status.primaryFeature = status.activeFeatures[0] || null;
  }

  savePdcaStatus(status);
  debugLog('PDCA', `Manual cleanup: deleted ${deleted.length} features`);
  return {
    success: true,
    deletedCount: deleted.length,
    deleted,
    remaining: Object.keys(status.features).length
  };
}

function archiveFeatureToSummary(feature) {
  const { debugLog } = getCore();
  const status = getPdcaStatusFull(true);

  if (!status) return { success: false, reason: 'Status not found' };
  if (!status.features[feature]) return { success: false, reason: 'Feature not found' };

  const full = status.features[feature];
  if (full.phase !== 'archived' && full.phase !== 'completed') {
    return { success: false, reason: 'Feature must be archived or completed' };
  }

  status.features[feature] = {
    phase: 'archived',
    matchRate: full.matchRate,
    iterationCount: full.iterationCount || 0,
    startedAt: full.timestamps?.started || null,
    archivedAt: full.timestamps?.archivedAt || new Date().toISOString(),
    archivedTo: full.archivedTo || null
  };

  status.activeFeatures = status.activeFeatures.filter(f => f !== feature);
  if (status.primaryFeature === feature) {
    status.primaryFeature = status.activeFeatures[0] || null;
  }

  status.history.push({
    timestamp: new Date().toISOString(),
    action: 'feature_summarized',
    feature: feature
  });
  if (status.history.length > 100) {
    status.history = status.history.slice(-100);
  }

  savePdcaStatus(status);
  debugLog('PDCA', `Feature summarized: ${feature}`);
  return { success: true, summarizedFeature: feature };
}

function getActiveFeatures() {
  const status = getPdcaStatusFull();
  return status?.activeFeatures || [];
}

function switchFeatureContext(feature) {
  const status = getPdcaStatusFull(true);
  if (!status) return false;
  if (!status.features[feature]) return false;

  status.primaryFeature = feature;
  if (!status.activeFeatures.includes(feature)) {
    status.activeFeatures.push(feature);
  }

  savePdcaStatus(status);
  return true;
}

module.exports = {
  getFeatureStatus,
  updatePdcaStatus,
  addPdcaHistory,
  completePdcaFeature,
  setActiveFeature,
  addActiveFeature,
  removeActiveFeature,
  deleteFeatureFromStatus,
  enforceFeatureLimit,
  getArchivedFeatures,
  cleanupArchivedFeatures,
  archiveFeatureToSummary,
  getActiveFeatures,
  switchFeatureContext,
};
