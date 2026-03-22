/**
 * mcukit Embedded Dev Kit - SessionStart: Migration Module (v2.0.0)
 *
 * Handles state file migration from legacy paths (docs/) to .mcukit/ structured paths.
 * Includes LEGACY_PATHS detection, auto-migration, and version schema upgrades.
 */

const fs = require('fs');
const { debugLog } = require('../../lib/core/debug');

/**
 * Run legacy path migration.
 * Migrates state files from docs/ flat paths to .mcukit/ structured paths.
 * @param {object} _input - Hook input (unused, reserved for future use)
 * @returns {{ migrated: string[], errors: string[] }} Migration result
 */
function run(_input) {
  const result = { migrated: [], errors: [] };

  try {
    const { STATE_PATHS, LEGACY_PATHS, ensureMcukitDirs } = require('../../lib/core/paths');
    ensureMcukitDirs();

    const migrations = [
      { from: LEGACY_PATHS.pdcaStatus(), to: STATE_PATHS.pdcaStatus(), name: 'pdca-status', type: 'file' },
      { from: LEGACY_PATHS.memory(), to: STATE_PATHS.memory(), name: 'memory', type: 'file' },
      { from: LEGACY_PATHS.agentState(), to: STATE_PATHS.agentState(), name: 'agent-state', type: 'file' },
      { from: LEGACY_PATHS.snapshots(), to: STATE_PATHS.snapshots(), name: 'snapshots', type: 'directory' },
    ];

    for (const m of migrations) {
      try {
        if (!fs.existsSync(m.from)) continue;

        if (m.type === 'directory' && fs.existsSync(m.to)) {
          if (fs.readdirSync(m.to).length > 0) continue;
          fs.rmdirSync(m.to);
        } else if (fs.existsSync(m.to)) {
          continue;
        }

        try {
          fs.renameSync(m.from, m.to);
        } catch (renameErr) {
          if (renameErr.code === 'EXDEV') {
            if (m.type === 'directory') {
              fs.cpSync(m.from, m.to, { recursive: true });
            } else {
              fs.copyFileSync(m.from, m.to);
            }
            fs.rmSync(m.from, { recursive: true, force: true });
          } else {
            throw renameErr;
          }
        }
        debugLog('SessionStart', `Migrated ${m.name}`, { from: m.from, to: m.to });
        result.migrated.push(m.name);
      } catch (fileErr) {
        debugLog('SessionStart', `Migration failed: ${m.name}`, { error: fileErr.message });
        result.errors.push(m.name);
      }
    }
  } catch (e) {
    debugLog('SessionStart', 'Path migration skipped', { error: e.message });
    result.errors.push('init');
  }

  return result;
}

module.exports = { run };
