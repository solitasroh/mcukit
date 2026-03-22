/**
 * Executive Summary Module
 * @module lib/pdca/executive-summary
 * @version 1.6.0
 */

const path = require('path');

// Lazy require
let _core = null;
function getCore() {
  if (!_core) { _core = require('../core'); }
  return _core;
}

let _status = null;
function getStatus() {
  if (!_status) { _status = require('./status'); }
  return _status;
}

let _phase = null;
function getPhase() {
  if (!_phase) { _phase = require('./phase'); }
  return _phase;
}

/**
 * Get next actions based on PDCA phase
 * @private
 * @param {string} phase - Current PDCA phase
 * @param {string} feature - Feature name
 * @param {Object} context - Additional context
 * @returns {Array<{label: string, command: string, description: string}>}
 */
function _getNextActions(phase, feature, context = {}) {
  const { matchRate = 0 } = context;

  const actionSets = {
    'plan-plus': [
      { label: 'Start Design', command: `/pdca design ${feature}`, description: 'Start technical design document' },
      { label: 'Revise Plan', command: `/plan-plus ${feature}`, description: 'Revise plan document' },
      { label: 'Request Team Review', command: `/pdca team ${feature}`, description: 'Request CTO Team review' }
    ],
    'plan': [
      { label: 'Start Design', command: `/pdca design ${feature}`, description: 'Start technical design based on plan' },
      { label: 'Revise Plan', command: `/plan-plus ${feature}`, description: 'Apply changes to plan document' },
      { label: 'Other Feature First', command: `/pdca status`, description: 'Pause this feature' }
    ],
    'report': [
      { label: 'Archive', command: `/pdca archive ${feature}`, description: 'Archive completed PDCA documents' },
      { label: 'Further Improvement', command: `/pdca iterate ${feature}`, description: 'Move to Act phase for improvement' },
      { label: 'Next Feature', command: `/pdca plan`, description: 'Start new feature' }
    ],
    'check': matchRate >= 90
      ? [
          { label: 'Generate Report', command: `/pdca report ${feature}`, description: 'Generate completion report' },
          { label: '/simplify Cleanup', command: `/simplify`, description: 'Clean up code quality then report' },
          { label: 'Manual Fix', command: '', description: 'Manually fix code then re-analyze' }
        ]
      : [
          { label: 'Auto Improve', command: `/pdca iterate ${feature}`, description: 'Auto-improve via Act iteration' },
          { label: 'Generate Report', command: `/pdca report ${feature}`, description: 'Generate report at current rate' },
          { label: 'Manual Fix', command: '', description: 'Manually fix code then re-analyze' }
        ]
  };

  return actionSets[phase] || actionSets['plan'];
}

/**
 * v1.5.9: Generate executive summary data structure
 * @param {string} feature - Feature name
 * @param {string} phase - Current PDCA phase ('plan'|'plan-plus'|'report'|'check')
 * @param {Object} [context] - Additional context
 * @param {number} [context.matchRate] - Gap analysis match rate
 * @param {number} [context.iterationCount] - Iteration count
 * @returns {Object} Executive summary data
 */
function generateExecutiveSummary(feature, phase, context = {}) {
  const { debugLog } = getCore();
  const { getPdcaStatusFull } = getStatus();

  const status = getPdcaStatusFull();
  const featureData = status?.features?.[feature] || {};

  const matchRate = context.matchRate ?? featureData.matchRate ?? null;
  const iterationCount = context.iterationCount ?? featureData.iterationCount ?? 0;

  debugLog('ExecutiveSummary', 'Generating summary', { feature, phase });

  return {
    type: 'executive-summary',
    feature,
    phase,
    summary: {
      problem: null,
      solution: null,
      functionUxEffect: null,
      coreValue: null
    },
    nextActions: _getNextActions(phase, feature, { matchRate }),
    metadata: {
      matchRate,
      iterationCount,
      generatedAt: new Date().toISOString()
    }
  };
}

/**
 * v1.5.9: Format executive summary for CLI output
 * @param {Object} summary - generateExecutiveSummary() return value
 * @param {'full'|'compact'} [format='full'] - Output format
 * @returns {string} Formatted string
 */
function formatExecutiveSummary(summary, format = 'full') {
  if (!summary) return '';

  const { feature, phase, metadata } = summary;
  const s = summary.summary || {};
  const date = metadata?.generatedAt?.split('T')[0] || '';

  if (format === 'compact') {
    return [
      `-- EXEC SUMMARY: ${feature} -- ${date} --`,
      `  PROBLEM    ${s.problem || '-'}`,
      `  SOLUTION   ${s.solution || '-'}`,
      `  EFFECT     ${s.functionUxEffect || '-'}`,
      `  VALUE      ${s.coreValue || '-'}`,
      `------------------------------------------`
    ].join('\n');
  }

  // full format
  const lines = [
    `EXECUTIVE SUMMARY`,
    `  ${feature}  (${phase})  ${date}`,
    '',
    `  [PROBLEM]`,
    `  ${s.problem || '-'}`,
    '',
    `  [SOLUTION]`,
    `  ${s.solution || '-'}`,
    '',
    `  [FUNCTION & UX EFFECT]`,
    `  ${s.functionUxEffect || '-'}`,
    '',
    `  [CORE VALUE]`,
    `  ${s.coreValue || '-'}`,
  ];

  if (summary.nextActions?.length) {
    lines.push('', `  NEXT ACTION`);
    summary.nextActions.forEach((a, i) => {
      lines.push(`  [${i + 1}] ${a.label}  ${a.command}`);
    });
  }

  return lines.join('\n');
}

/**
 * v1.5.9: Generate batch summary for multiple features
 * @param {string[]} features - Feature names
 * @returns {Object|null} Batch summary with per-feature data
 */
function generateBatchSummary(features) {
  if (!Array.isArray(features) || features.length === 0) return null;

  const { debugLog } = getCore();
  const { getPdcaStatusFull } = getStatus();

  const status = getPdcaStatusFull();

  debugLog('ExecutiveSummary', 'Batch summary', { count: features.length });

  return {
    type: 'batch-summary',
    features: features.map(f => {
      const data = status?.features?.[f] || {};
      return {
        feature: f,
        phase: data.phase || 'unknown',
        matchRate: data.matchRate || null,
        iterationCount: data.iterationCount || 0
      };
    }),
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  generateExecutiveSummary,
  formatExecutiveSummary,
  generateBatchSummary,
};
