/**
 * Backup Scheduler - Debounced backup to PLUGIN_DATA
 * @module lib/core/backup-scheduler
 * @version 2.0.0
 *
 * Schedules debounced backups of state files to ${CLAUDE_PLUGIN_DATA}.
 * Uses existing backupToPluginData() from paths.js internally.
 */

// Lazy require to avoid circular dependency
let _paths = null;
function getPaths() {
  if (!_paths) { _paths = require('./paths'); }
  return _paths;
}

let _debug = null;
function getDebug() {
  if (!_debug) { _debug = require('./debug'); }
  return _debug;
}

/** @type {NodeJS.Timeout|null} */
let _backupTimer = null;

/** @type {Set<string>} */
let _pendingFiles = new Set();

/** Default debounce delay in milliseconds */
const DEFAULT_DELAY_MS = 5000;

/**
 * Schedule a debounced backup.
 * Multiple calls within the delay window are coalesced into a single backup.
 * @param {string} filename - File identifier ('pdca-status', 'memory', 'quality-metrics')
 * @param {number} [delayMs=5000] - Debounce delay in milliseconds
 */
function scheduleBackup(filename, delayMs) {
  const delay = typeof delayMs === 'number' && delayMs >= 0 ? delayMs : DEFAULT_DELAY_MS;

  _pendingFiles.add(filename);

  // Reset the timer on each call (debounce behavior)
  if (_backupTimer) {
    clearTimeout(_backupTimer);
    _backupTimer = null;
  }

  _backupTimer = setTimeout(() => {
    _executeBackup();
  }, delay);
}

/**
 * Immediately flush all pending backups.
 * Cancels any pending timer and runs backup synchronously.
 * @returns {{backed: string[], skipped: string[]}}
 */
function flushBackup() {
  // Cancel pending timer
  if (_backupTimer) {
    clearTimeout(_backupTimer);
    _backupTimer = null;
  }

  if (_pendingFiles.size === 0) {
    return { backed: [], skipped: ['no pending backups'] };
  }

  return _executeBackup();
}

/**
 * Cancel all pending backups without executing them.
 */
function cancelPendingBackups() {
  if (_backupTimer) {
    clearTimeout(_backupTimer);
    _backupTimer = null;
  }

  const cancelled = Array.from(_pendingFiles);
  _pendingFiles.clear();

  getDebug().debugLog('BACKUP', 'Cancelled pending backups', { cancelled });
}

/**
 * Get pending backup status.
 * @returns {{pending: string[], timerActive: boolean}}
 */
function getPendingStatus() {
  return {
    pending: Array.from(_pendingFiles),
    timerActive: _backupTimer !== null,
  };
}

/**
 * Execute backup for all pending files.
 * @returns {{backed: string[], skipped: string[]}}
 * @private
 */
function _executeBackup() {
  const files = Array.from(_pendingFiles);
  _pendingFiles.clear();
  _backupTimer = null;

  if (files.length === 0) {
    return { backed: [], skipped: ['no pending files'] };
  }

  try {
    const result = getPaths().backupToPluginData();
    getDebug().debugLog('BACKUP', 'Flushed backups', { files, result });
    return result;
  } catch (e) {
    getDebug().debugLog('BACKUP', 'Backup failed', { files, error: e.message });
    return { backed: [], skipped: [e.message] };
  }
}

module.exports = {
  DEFAULT_DELAY_MS,
  scheduleBackup,
  flushBackup,
  cancelPendingBackups,
  getPendingStatus,
};
