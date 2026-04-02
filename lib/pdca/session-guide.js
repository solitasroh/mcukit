/**
 * Session Guide - Context Anchor based session planning
 * @module lib/pdca/session-guide
 * @version 2.0.5
 *
 * Extracts Context Anchors from PDCA documents and suggests
 * optimal session breakdown based on module decomposition.
 * One module per session principle.
 */

const path = require('path');

// Lazy requires to avoid circular dependencies
let _contextLoader = null;
function getContextLoader() {
  if (!_contextLoader) { _contextLoader = require('../context/context-loader'); }
  return _contextLoader;
}

let _paths = null;
function getPaths() {
  if (!_paths) { _paths = require('../core/paths'); }
  return _paths;
}

/**
 * Extract Context Anchor for a feature (delegates to context-loader)
 * @param {string} feature - Feature name
 * @returns {{ WHY: string, WHO: string, RISK: string, SUCCESS: string, SCOPE: string }}
 */
function extractContextAnchor(feature) {
  return getContextLoader().extractContextAnchor(feature);
}

/**
 * Format Context Anchor as markdown for session preamble
 * @param {{ WHY: string, WHO: string, RISK: string, SUCCESS: string, SCOPE: string }} anchor
 * @returns {string} Markdown-formatted anchor block
 */
function formatContextAnchor(anchor) {
  if (!anchor) return '';

  var lines = [
    '## Context Anchor',
    '',
    '| Key | Value |',
    '|-----|-------|',
    '| **WHY** | ' + (anchor.WHY || 'N/A') + ' |',
    '| **WHO** | ' + (anchor.WHO || 'N/A') + ' |',
    '| **RISK** | ' + (anchor.RISK || 'N/A') + ' |',
    '| **SUCCESS** | ' + (anchor.SUCCESS || 'N/A') + ' |',
    '| **SCOPE** | ' + (anchor.SCOPE || 'N/A') + ' |',
  ];

  return lines.join('\n');
}

/**
 * Analyze Design document to extract module decomposition
 * @param {string} feature - Feature name
 * @returns {{ modules: Object[], totalFiles: number }}
 */
function analyzeModules(feature) {
  var loader = getContextLoader();
  var designCtx = loader.loadDesignContext(feature);

  var modules = [];
  var seen = {};

  // Group files by directory (module = directory group)
  for (var i = 0; i < designCtx.files.length; i++) {
    var filePath = designCtx.files[i];
    var dir = path.dirname(filePath);
    var moduleName = dir === '.' ? 'root' : dir;

    if (!seen[moduleName]) {
      seen[moduleName] = { name: moduleName, files: [], decisions: [] };
      modules.push(seen[moduleName]);
    }
    seen[moduleName].files.push(filePath);
  }

  // Attach decisions to modules (heuristic: match by file path mention)
  for (var d = 0; d < designCtx.decisions.length; d++) {
    var decision = designCtx.decisions[d];
    var assigned = false;

    for (var m = 0; m < modules.length; m++) {
      for (var f = 0; f < modules[m].files.length; f++) {
        if (decision.indexOf(modules[m].files[f]) !== -1 ||
            decision.indexOf(modules[m].name) !== -1) {
          modules[m].decisions.push(decision);
          assigned = true;
          break;
        }
      }
      if (assigned) break;
    }

    // Unassigned decisions go to first module or a general bucket
    if (!assigned && modules.length > 0) {
      modules[0].decisions.push(decision);
    }
  }

  // If no files found in design doc, create modules from explicit module sections
  if (modules.length === 0 && designCtx.modules.length > 0) {
    for (var k = 0; k < designCtx.modules.length; k++) {
      modules.push({
        name: designCtx.modules[k],
        files: [],
        decisions: [],
      });
    }
  }

  return {
    modules: modules,
    totalFiles: designCtx.files.length,
  };
}

/**
 * Suggest session breakdown based on module analysis
 * Follows the one-module-per-session principle.
 * @param {Object[]} modules - Module list from analyzeModules
 * @returns {{ sessions: Object[], totalSessions: number, recommendation: string }}
 */
function suggestSessions(modules) {
  if (!modules || modules.length === 0) {
    return {
      sessions: [],
      totalSessions: 0,
      recommendation: 'No modules detected. Create a Design document first with /pdca design.',
    };
  }

  var sessions = [];

  for (var i = 0; i < modules.length; i++) {
    var mod = modules[i];
    var complexity = estimateComplexity(mod);

    sessions.push({
      sessionNumber: i + 1,
      moduleName: mod.name,
      files: mod.files,
      fileCount: mod.files.length,
      decisions: mod.decisions,
      estimatedComplexity: complexity,
      description: 'Implement module `' + mod.name + '` (' + mod.files.length + ' file(s))',
    });
  }

  var totalFiles = 0;
  for (var j = 0; j < modules.length; j++) {
    totalFiles += modules[j].files.length;
  }

  var recommendation = sessions.length + ' session(s) recommended for '
    + totalFiles + ' file(s) across ' + modules.length + ' module(s). '
    + 'Start each session by pasting the Context Anchor.';

  return {
    sessions: sessions,
    totalSessions: sessions.length,
    recommendation: recommendation,
  };
}

// ── Internal Helpers ──────────────────────────────────────────────

/**
 * Estimate module complexity based on file count and type
 * @param {Object} mod - Module object
 * @returns {string} Complexity level (low/medium/high)
 */
function estimateComplexity(mod) {
  var fileCount = mod.files.length;
  var hasHardware = false;

  for (var i = 0; i < mod.files.length; i++) {
    if (/\.(ld|dts|dtsi|s|S)$/.test(mod.files[i])) {
      hasHardware = true;
      break;
    }
  }

  if (hasHardware || fileCount > 5) return 'high';
  if (fileCount > 2) return 'medium';
  return 'low';
}

module.exports = {
  extractContextAnchor,
  formatContextAnchor,
  analyzeModules,
  suggestSessions,
};
