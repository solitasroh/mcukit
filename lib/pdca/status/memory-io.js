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

function readMemory() {
  const { safeJsonParse, debugLog } = getCore();
  const { STATE_PATHS } = require('../../core/paths');
  const memoryPath = STATE_PATHS.memory();
  try {
    if (fs.existsSync(memoryPath)) {
      const content = fs.readFileSync(memoryPath, 'utf8');
      const parsed = safeJsonParse(content);
      if (parsed == null && content.trim().length > 0) {
        // safeJsonParse returned null on non-empty input → JSON corruption.
        // Quarantine the file so we don't silently mask data loss.
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
    return false;
  }
}

module.exports = {
  readMemory,
  writeMemory,
};
