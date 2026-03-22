/**
 * mcukit Embedded Dev Kit - SessionStart: Restore Module (v2.0.0)
 *
 * Handles PLUGIN_DATA restoration, corrupted file detection,
 * and backup integrity verification.
 */

const { debugLog } = require('../../lib/core/debug');

/**
 * Run PLUGIN_DATA restore.
 * Restores state files from ${CLAUDE_PLUGIN_DATA} backup if primary files are missing.
 * @param {object} _input - Hook input (unused, reserved for future use)
 * @returns {{ restored: string[], errors: string[] }} Restore result
 */
function run(_input) {
  const result = { restored: [], errors: [] };

  try {
    const { restoreFromPluginData } = require('../../lib/core/paths');
    const restoreResult = restoreFromPluginData();
    if (restoreResult.restored.length > 0) {
      debugLog('SessionStart', 'Restored from PLUGIN_DATA backup', {
        restored: restoreResult.restored
      });
      result.restored = restoreResult.restored;
    }
  } catch (e) {
    debugLog('SessionStart', 'PLUGIN_DATA restore skipped', { error: e.message });
    result.errors.push(e.message);
  }

  return result;
}

module.exports = { run };
