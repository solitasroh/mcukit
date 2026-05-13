/**
 * Memory.json IO (.rkit/state/memory.json)
 * @module lib/pdca/status/memory-io
 *
 * Extracted from lib/pdca/status.js (Cycle 2 G adopt — SQ-004 split).
 * Owns: readMemory, writeMemory. Backward-compat aliases (readBkitMemory /
 * writeBkitMemory) exported via the facade.
 */

const fs = require('fs');

let _core = null;
function getCore() {
  if (!_core) _core = require('../../core');
  return _core;
}

/**
 * Read memory.json with corruption recovery.
 *
 * Two quarantine entry paths exist by design:
 *   (a) safeJsonParse returns null on non-empty content (no throw) → JSON parse
 *       silently failed inside safeJsonParse; we quarantine here. Specific
 *       SyntaxError details are lost because safeJsonParse swallows them.
 *   (b) readFileSync throws (EIO disk error, EACCES) or JSON.parse throws if
 *       safeJsonParse re-throws SyntaxError under future implementations.
 *
 * Both paths rename the corrupted file to `<path>.corrupted.<ts>` and return
 * null so callers see "no memory" instead of silently masking data loss.
 */
function readMemory() {
  const { safeJsonParse, debugLog } = getCore();
  const { STATE_PATHS } = require('../../core/paths');
  const memoryPath = STATE_PATHS.memory();
  try {
    if (fs.existsSync(memoryPath)) {
      const content = fs.readFileSync(memoryPath, 'utf8');
      const parsed = safeJsonParse(content);
      if (parsed == null && content.trim().length > 0) {
        // Path (a): safeJsonParse returned null on non-empty input → JSON corruption.
        // Quarantine so we don't silently mask data loss.
        try {
          const quarantine = `${memoryPath}.corrupted.${Date.now()}`;
          fs.renameSync(memoryPath, quarantine);
          debugLog('PDCA', 'memory.json corrupted — quarantined', { quarantine });
        } catch (qerr) {
          debugLog('PDCA', 'memory.json quarantine failed', { error: qerr.message });
        }
      }
      return parsed;
    }
  } catch (e) {
    debugLog('PDCA', 'memory.json read failed', { error: e.message, path: memoryPath });
    if (e && (e instanceof SyntaxError || e.code === 'EIO')) {
      try {
        const quarantine = `${memoryPath}.corrupted.${Date.now()}`;
        fs.renameSync(memoryPath, quarantine);
        debugLog('PDCA', 'memory.json corrupted — quarantined', { quarantine });
      } catch (qerr) {
        debugLog('PDCA', 'memory.json quarantine failed', { error: qerr.message });
      }
    }
  }
  return null;
}

function writeMemory(memory) {
  const { STATE_PATHS } = require('../../core/paths');
  const memoryPath = STATE_PATHS.memory();
  try {
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2) + '\n', 'utf8');

    try {
      const { backupToPluginData } = require('../../core/paths');
      backupToPluginData();
    } catch (e) {
      getCore().debugLog('PDCA', 'PLUGIN_DATA backup failed (memory)', { error: e.message });
    }

    return true;
  } catch (e) {
    // Surface write failure (ENOSPC, EACCES, EROFS, EBUSY, ENOENT/parent dir
    // missing) — silent false return previously masked disk-full scenarios.
    // (PR #6 S2)
    getCore().debugLog('PDCA', 'memory.json write failed', {
      error: e.message,
      code: e.code,
      path: memoryPath,
    });
    return false;
  }
}

module.exports = {
  readMemory,
  writeMemory,
};
