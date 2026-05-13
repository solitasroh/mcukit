/**
 * PDCA Feature Context Extraction
 * @module lib/pdca/status/context
 *
 * Extracted from lib/pdca/status.js (Cycle 2 G adopt — SQ-004 split).
 * Owns: extractFeatureFromContext.
 */

let _core = null;
function getCore() {
  if (!_core) _core = require('../../core');
  return _core;
}

const { getPdcaStatusFull } = require('./store');

/**
 * Extract feature from context sources
 * @param {Object} sources
 * @returns {string}
 */
function extractFeatureFromContext(sources = {}) {
  if (sources.feature) return sources.feature;

  if (sources.filePath) {
    const { getConfig } = getCore();
    const featurePatterns = getConfig('featurePatterns', [
      'features', 'modules', 'packages', 'domains'
    ]);

    for (const pattern of featurePatterns) {
      const regex = new RegExp(`${pattern}/([^/]+)`);
      const match = sources.filePath.match(regex);
      if (match && match[1]) return match[1];
    }
  }

  const status = getPdcaStatusFull();
  return status?.primaryFeature || '';
}

module.exports = {
  extractFeatureFromContext,
};
