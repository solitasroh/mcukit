/**
 * Build History Manager
 * @module lib/mcu/build-history
 * @version 0.1.0
 *
 * Tracks Flash/RAM usage across builds for trend analysis.
 * Creates and maintains .rkit/state/build-history.json
 */

const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 100;

/**
 * Get build history file path
 * @returns {string}
 */
function getHistoryPath() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return path.join(projectDir, '.rkit', 'state', 'build-history.json');
}

/**
 * Load build history
 * @returns {{ history: Array, maxEntries: number }}
 */
function loadBuildHistory() {
  const historyPath = getHistoryPath();
  try {
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }
  } catch (_e) {}
  return { history: [], maxEntries: MAX_ENTRIES };
}

/**
 * Add a build record to history
 * @param {Object} record
 * @param {string} record.feature - Feature name
 * @param {Object} record.flash - { used: number, total: number, percent: number }
 * @param {Object} record.ram - { used: number, total: number, percent: number }
 * @param {Array} [record.topSymbols] - Top symbols by size
 */
function addBuildRecord(record) {
  const data = loadBuildHistory();

  data.history.push({
    timestamp: new Date().toISOString(),
    ...record,
  });

  // Trim to maxEntries
  if (data.history.length > data.maxEntries) {
    data.history = data.history.slice(-data.maxEntries);
  }

  saveBuildHistory(data);
}

/**
 * Save build history to file
 * @param {Object} data
 */
function saveBuildHistory(data) {
  const historyPath = getHistoryPath();
  const dir = path.dirname(historyPath);

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(historyPath, JSON.stringify(data, null, 2));
  } catch (_e) {}
}

/**
 * Get memory usage delta between last two builds
 * @returns {{ flashDelta: number, ramDelta: number }|null}
 */
function getLastDelta() {
  const { history } = loadBuildHistory();
  if (history.length < 2) return null;

  const curr = history[history.length - 1];
  const prev = history[history.length - 2];

  return {
    flashDelta: (curr.flash?.used || 0) - (prev.flash?.used || 0),
    ramDelta: (curr.ram?.used || 0) - (prev.ram?.used || 0),
  };
}

module.exports = {
  loadBuildHistory,
  addBuildRecord,
  saveBuildHistory,
  getLastDelta,
};
