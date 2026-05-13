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
  const { safeJsonParse } = getCore();
  const { STATE_PATHS } = require('../../core/paths');
  const memoryPath = STATE_PATHS.memory();
  try {
    if (fs.existsSync(memoryPath)) {
      const content = fs.readFileSync(memoryPath, 'utf8');
      return safeJsonParse(content);
    }
  } catch (e) {
    // Silently fail
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
