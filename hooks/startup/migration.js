/**
 * rkit Embedded Dev Kit - SessionStart: Migration Module (v2.1.0)
 *
 * Handles state file migration:
 * 1. Legacy docs/ flat paths → .rkit/ structured paths (v1.5.7→v1.5.9)
 * 2. Legacy .bkit/ directory → .rkit/ directory (v2.1.0, bkit-gstack-sync)
 *
 * Includes LEGACY_PATHS detection, auto-migration, and version schema upgrades.
 */

const fs = require('fs');
const path = require('path');
const { debugLog } = require('../../lib/core/debug');

/**
 * Migrate .bkit/ → .rkit/ (v2.1.0)
 * Copies newer files from .bkit/ subdirs into .rkit/, then removes .bkit/.
 * Uses newer-wins strategy: only overwrite if source mtime > target mtime.
 * @param {object} result - Migration result accumulator
 */
function migrateBkitDir(result) {
  const { getMcukitRoot } = require('../../lib/core/paths');
  const projectRoot = process.cwd();
  const bkitDir = path.join(projectRoot, '.bkit');
  const rkitDir = path.join(projectRoot, getMcukitRoot());

  if (!fs.existsSync(bkitDir)) return;

  const subdirs = ['state', 'runtime', 'audit', 'checkpoints', 'decisions', 'snapshots', 'workflows'];

  for (const sub of subdirs) {
    const srcDir = path.join(bkitDir, sub);
    const dstDir = path.join(rkitDir, sub);
    if (!fs.existsSync(srcDir)) continue;

    try {
      if (!fs.existsSync(dstDir)) {
        fs.mkdirSync(dstDir, { recursive: true });
      }

      const entries = fs.readdirSync(srcDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const srcFile = path.join(srcDir, entry.name);
        const dstFile = path.join(dstDir, entry.name);

        // Newer-wins: skip if dest is newer or equal
        if (fs.existsSync(dstFile)) {
          const srcStat = fs.statSync(srcFile);
          const dstStat = fs.statSync(dstFile);
          if (dstStat.mtimeMs >= srcStat.mtimeMs) continue;
        }

        fs.copyFileSync(srcFile, dstFile);

        // Rewrite .bkit/ path references inside JSON files
        if (entry.name.endsWith('.json')) {
          try {
            const content = fs.readFileSync(dstFile, 'utf8');
            if (content.includes('.bkit/')) {
              const rewritten = content.replace(/\.bkit\//g, '.rkit/');
              fs.writeFileSync(dstFile, rewritten, 'utf8');
            }
          } catch (_) { /* non-critical */ }
        }
      }
      result.migrated.push(`bkit/${sub}`);
    } catch (e) {
      debugLog('SessionStart', `bkit migration failed: ${sub}`, { error: e.message });
      result.errors.push(`bkit/${sub}`);
    }
  }

  // Remove .bkit/ after successful migration
  if (result.errors.filter(e => e.startsWith('bkit/')).length === 0) {
    try {
      fs.rmSync(bkitDir, { recursive: true, force: true });
      debugLog('SessionStart', 'Removed legacy .bkit/ directory');
      result.migrated.push('bkit-cleanup');
    } catch (e) {
      debugLog('SessionStart', 'Failed to remove .bkit/', { error: e.message });
    }
  }
}

/**
 * Run legacy path migration.
 * Migrates state files from docs/ flat paths to .rkit/ structured paths,
 * then migrates .bkit/ → .rkit/ if .bkit/ still exists.
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

  // v2.1.0: Migrate .bkit/ → .rkit/ (bkit-gstack-sync)
  try {
    migrateBkitDir(result);
  } catch (e) {
    debugLog('SessionStart', 'bkit dir migration skipped', { error: e.message });
  }

  return result;
}

module.exports = { run };
