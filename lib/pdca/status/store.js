/**
 * PDCA Status File/Cache IO
 * @module lib/pdca/status/store
 *
 * Extracted from lib/pdca/status.js (Cycle 2 G adopt — SQ-004 split).
 * Owns: path resolution, cache key, file init/load/save, auto-migration dispatch.
 */

const fs = require('fs');
const path = require('path');

let _core = null;
function getCore() {
  if (!_core) _core = require('../../core');
  return _core;
}

function _getCacheKey() {
  try {
    const { PROJECT_DIR } = require('../../core/platform');
    return `pdca-status:${PROJECT_DIR}`;
  } catch (e) {
    return 'pdca-status';
  }
}

function getPdcaStatusPath() {
  const { STATE_PATHS } = require('../../core/paths');
  return STATE_PATHS.pdcaStatus();
}

function initPdcaStatusIfNotExists() {
  const { globalCache, debugLog } = getCore();
  const statusPath = getPdcaStatusPath();

  if (fs.existsSync(statusPath)) return;

  const docsDir = path.dirname(statusPath);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const { createInitialStatusV2 } = require('./schema');
  const initialStatus = createInitialStatusV2();
  fs.writeFileSync(statusPath, JSON.stringify(initialStatus, null, 2));
  globalCache.set(_getCacheKey(), initialStatus);
  debugLog('PDCA', 'Status file initialized (v2.0)', { path: statusPath });
}

function getPdcaStatusFull(forceRefresh = false) {
  const { globalCache, debugLog } = getCore();
  const statusPath = getPdcaStatusPath();

  try {
    if (!forceRefresh) {
      const cached = globalCache.get(_getCacheKey(), 3000);
      if (cached) return cached;
    }

    if (!fs.existsSync(statusPath)) return null;

    const { migrateStatusToV2, migrateStatusV2toV3 } = require('./schema');
    let status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));

    if (!status.version || status.version === "1.0") {
      status = migrateStatusToV2(status);
      status = migrateStatusV2toV3(status);
      savePdcaStatus(status);
    } else if (status.version === "2.0") {
      status = migrateStatusV2toV3(status);
      savePdcaStatus(status);
    }

    globalCache.set(_getCacheKey(), status);
    return status;
  } catch (e) {
    debugLog('PDCA', 'Failed to read status', { error: e.message });
    return null;
  }
}

function loadPdcaStatus() {
  return getPdcaStatusFull();
}

function savePdcaStatus(status) {
  const { globalCache, debugLog } = getCore();
  const statusPath = getPdcaStatusPath();

  try {
    status.lastUpdated = new Date().toISOString();
    if (status.session) {
      status.session.lastActivity = status.lastUpdated;
    }

    const docsDir = path.dirname(statusPath);
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
    globalCache.set(_getCacheKey(), status);
    debugLog('PDCA', 'Status saved', { version: status.version });

    try {
      const { backupToPluginData } = require('../../core/paths');
      backupToPluginData();
    } catch (e) {
      debugLog('PDCA', 'PLUGIN_DATA backup failed', { error: e.message });
    }
  } catch (e) {
    debugLog('PDCA', 'Failed to save status', { error: e.message });
  }
}

module.exports = {
  getPdcaStatusPath,
  initPdcaStatusIfNotExists,
  getPdcaStatusFull,
  loadPdcaStatus,
  savePdcaStatus,
};
