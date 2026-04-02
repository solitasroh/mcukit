/**
 * Decision Record - Architecture Decision Record (ADR) management
 * @module lib/context/decision-record
 * @version 2.0.5
 *
 * Records and retrieves architecture decisions in JSON format.
 * Stored in .mcukit/decisions/{timestamp}-{slug}.json.
 */

const fs = require('fs');
const path = require('path');

// Lazy require paths to avoid circular dependency
let _paths = null;
function getPaths() {
  if (!_paths) { _paths = require('../core/paths'); }
  return _paths;
}

/**
 * Record an architecture decision
 * @param {{ title: string, context: string, decision: string, consequences: string, domain: string }} entry
 * @returns {{ saved: boolean, path: string, id: string }}
 */
function recordDecision(entry) {
  if (!entry || !entry.title) {
    return { saved: false, path: '', id: '', error: 'title is required' };
  }

  var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  var slug = toSlug(entry.title);
  var id = timestamp + '-' + slug;
  var filename = id + '.json';

  var decisionsDir = getDecisionsDir();
  var filePath = path.join(decisionsDir, filename);

  var record = {
    id: id,
    title: entry.title,
    context: entry.context || '',
    decision: entry.decision || '',
    consequences: entry.consequences || '',
    domain: entry.domain || 'general',
    status: 'accepted',
    createdAt: new Date().toISOString(),
  };

  try {
    if (!fs.existsSync(decisionsDir)) {
      fs.mkdirSync(decisionsDir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
    return { saved: true, path: filePath, id: id };
  } catch (e) {
    return { saved: false, path: filePath, id: id, error: e.message };
  }
}

/**
 * List recorded decisions
 * @param {{ domain: string, limit: number }} [options] - Filter and pagination options
 * @returns {Object[]} Array of decision records
 */
function listDecisions(options) {
  var opts = options || {};
  var limit = opts.limit || 50;
  var decisionsDir = getDecisionsDir();

  if (!fs.existsSync(decisionsDir)) return [];

  var records = [];

  try {
    var files = fs.readdirSync(decisionsDir)
      .filter(function (f) { return f.endsWith('.json'); })
      .sort()
      .reverse(); // Newest first

    for (var i = 0; i < files.length && records.length < limit; i++) {
      try {
        var filePath = path.join(decisionsDir, files[i]);
        var record = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Domain filter
        if (opts.domain && record.domain !== opts.domain) continue;

        records.push(record);
      } catch (e) {
        // Skip corrupted files
      }
    }
  } catch (e) {
    // Directory unreadable
  }

  return records;
}

// ── Internal Helpers ──────────────────────────────────────────────

/**
 * Get decisions directory path from STATE_PATHS
 * @returns {string}
 */
function getDecisionsDir() {
  try {
    var paths = getPaths();
    return paths.STATE_PATHS.decisionsDir();
  } catch (e) {
    // Fallback if paths module unavailable
    return path.join(process.cwd(), '.mcukit', 'decisions');
  }
}

/**
 * Convert title to URL-friendly slug
 * @param {string} title
 * @returns {string}
 */
function toSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s가-힣-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

module.exports = {
  recordDecision,
  listDecisions,
};
