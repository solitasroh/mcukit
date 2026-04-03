/**
 * Quality Gate Manager - PDCA Phase-Level Quality Gates
 * @module lib/quality/gate-manager
 * @version 2.0.0
 *
 * Evaluates quality gates at each PDCA phase transition.
 * Supports 3 verdicts (pass/retry/fail) and level-specific threshold overrides.
 *
 * Design: docs/02-design/features/rkit-v200-enhancement.design.md Section 2.8
 * Plan: docs/01-plan/features/rkit-v200-enhancement.plan.md FR-16
 */

const path = require('path');
const stateStore = require('../core/state-store');
const { STATE_PATHS } = require('../core/paths');
const { MATCH_RATE_THRESHOLD, MAX_QUALITY_HISTORY } = require('../core/constants');

// ============================================================
// Gate Definitions (7 PDCA phases)
// ============================================================

/**
 * @typedef {Object} GateCondition
 * @property {string} metric - Metric identifier (e.g., 'matchRate', 'codeQualityScore')
 * @property {string} op - Operator: '>=', '<=', '===', '<', '>'
 * @property {number} value - Threshold value
 */

/**
 * @typedef {Object} GateDefinition
 * @property {GateCondition[]} pass - All conditions must be true for pass
 * @property {GateCondition[]} retry - Any condition triggers retry (instead of fail)
 * @property {GateCondition[]} fail - Any condition triggers hard fail
 */

/** @type {Record<string, GateDefinition>} */
const GATE_DEFINITIONS = {
  pm: {
    pass: [
      { metric: 'designCompleteness', op: '>=', value: 30 },
    ],
    retry: [
      { metric: 'designCompleteness', op: '<', value: 30 },
    ],
    fail: [],
  },
  plan: {
    pass: [
      { metric: 'designCompleteness', op: '>=', value: 50 },
    ],
    retry: [
      { metric: 'designCompleteness', op: '<', value: 50 },
    ],
    fail: [],
  },
  design: {
    pass: [
      { metric: 'designCompleteness', op: '>=', value: 80 },
      { metric: 'conventionCompliance', op: '>=', value: 70 },
    ],
    retry: [
      { metric: 'designCompleteness', op: '<', value: 80 },
    ],
    fail: [
      { metric: 'designCompleteness', op: '<', value: 40 },
    ],
  },
  do: {
    pass: [
      { metric: 'codeQualityScore', op: '>=', value: 60 },
      { metric: 'criticalIssueCount', op: '===', value: 0 },
    ],
    retry: [
      { metric: 'codeQualityScore', op: '<', value: 60 },
    ],
    fail: [
      { metric: 'criticalIssueCount', op: '>', value: 3 },
    ],
  },
  check: {
    pass: [
      { metric: 'matchRate', op: '>=', value: 90 },
      { metric: 'codeQualityScore', op: '>=', value: 70 },
      { metric: 'criticalIssueCount', op: '===', value: 0 },
      { metric: 'apiComplianceRate', op: '>=', value: 95 },
    ],
    retry: [
      { metric: 'matchRate', op: '<', value: 90 },
      { metric: 'codeQualityScore', op: '<', value: 70 },
    ],
    fail: [
      { metric: 'criticalIssueCount', op: '>', value: 0 },
      { metric: 'apiComplianceRate', op: '<', value: 80 },
    ],
  },
  act: {
    pass: [
      { metric: 'iterationEfficiency', op: '>=', value: 3 },
      { metric: 'matchRate', op: '>=', value: 85 },
    ],
    retry: [
      { metric: 'iterationEfficiency', op: '<', value: 3 },
    ],
    fail: [
      { metric: 'matchRate', op: '<', value: 60 },
    ],
  },
  report: {
    pass: [
      { metric: 'matchRate', op: '>=', value: 90 },
      { metric: 'criticalIssueCount', op: '===', value: 0 },
    ],
    retry: [],
    fail: [
      { metric: 'matchRate', op: '<', value: 90 },
      { metric: 'criticalIssueCount', op: '>', value: 0 },
    ],
  },
};

// ============================================================
// Level Threshold Overrides
// ============================================================

/**
 * Level-specific threshold overrides.
 * Values here replace the defaults in GATE_DEFINITIONS when matched.
 * @type {Record<string, Record<string, number>>}
 */
const LEVEL_THRESHOLD_OVERRIDES = {
  Starter: {
    matchRate: 80,
    codeQualityScore: 60,
    apiComplianceRate: 90,
    designCompleteness: 60,
    conventionCompliance: 60,
  },
  Dynamic: {
    // Uses default GATE_DEFINITIONS values — no overrides
  },
  Enterprise: {
    matchRate: 95,
    codeQualityScore: 80,
    apiComplianceRate: 98,
    designCompleteness: 90,
    conventionCompliance: 90,
  },
};

// ============================================================
// Core Functions
// ============================================================

/**
 * Evaluate a single gate condition against provided metrics.
 * @param {GateCondition} condition - Condition to evaluate
 * @param {Object} metrics - Collected metrics keyed by metric name
 * @param {Record<string, number>} [overrides] - Level threshold overrides
 * @returns {boolean} Whether the condition is satisfied
 */
function _evaluateCondition(condition, metrics, overrides) {
  const rawValue = metrics[condition.metric];
  if (rawValue == null) return false; // Missing metric = not satisfied

  const threshold = (overrides && overrides[condition.metric] != null)
    ? overrides[condition.metric]
    : condition.value;

  switch (condition.op) {
    case '>=': return rawValue >= threshold;
    case '<=': return rawValue <= threshold;
    case '===': return rawValue === threshold;
    case '>': return rawValue > threshold;
    case '<': return rawValue < threshold;
    default: return false;
  }
}

/**
 * Get effective thresholds for a phase after applying level overrides.
 * @param {string} phase - PDCA phase name
 * @param {string} projectLevel - 'Starter'|'Dynamic'|'Enterprise'
 * @returns {Object} Merged thresholds keyed by metric name
 */
function getEffectiveThresholds(phase, projectLevel) {
  const gate = GATE_DEFINITIONS[phase];
  if (!gate) return {};

  const overrides = LEVEL_THRESHOLD_OVERRIDES[projectLevel] || {};

  // Collect all unique metrics and their default thresholds from pass conditions
  const thresholds = {};
  for (const cond of gate.pass) {
    const effectiveValue = (overrides[cond.metric] != null)
      ? overrides[cond.metric]
      : cond.value;
    thresholds[cond.metric] = { default: cond.value, effective: effectiveValue, op: cond.op };
  }

  return thresholds;
}

/**
 * @typedef {Object} GateDetail
 * @property {string} metric - Metric name
 * @property {number|null} actual - Actual measured value
 * @property {number} threshold - Effective threshold
 * @property {string} op - Comparison operator
 * @property {boolean} passed - Whether this condition passed
 */

/**
 * @typedef {Object} GateResult
 * @property {'pass'|'retry'|'fail'} verdict - Overall gate verdict
 * @property {string} action - Resolved action description
 * @property {number} score - Gate score (0-100)
 * @property {GateDetail[]} details - Per-condition details
 * @property {string[]} blockers - Human-readable blocker descriptions
 * @property {string} recommendation - Actionable recommendation text
 */

/**
 * Check the quality gate for a given PDCA phase.
 * @param {string} phase - PDCA phase name (pm|plan|design|do|check|act|report)
 * @param {Object} context - Gate evaluation context
 * @param {Object} context.metrics - Current quality metrics keyed by metric name
 * @param {string} [context.projectLevel='Dynamic'] - Project level
 * @param {string} [context.feature] - Feature name (for recording)
 * @returns {GateResult}
 */
function checkGate(phase, context) {
  const gate = GATE_DEFINITIONS[phase];
  if (!gate) {
    return {
      verdict: 'pass',
      action: 'No gate defined for phase',
      score: 100,
      details: [],
      blockers: [],
      recommendation: 'No quality gate configured for this phase.',
    };
  }

  const metrics = context.metrics || {};
  const level = context.projectLevel || 'Dynamic';
  const overrides = LEVEL_THRESHOLD_OVERRIDES[level] || {};

  // Evaluate all pass conditions
  const details = [];
  let passCount = 0;
  const totalPass = gate.pass.length;

  for (const cond of gate.pass) {
    const passed = _evaluateCondition(cond, metrics, overrides);
    const effectiveThreshold = (overrides[cond.metric] != null)
      ? overrides[cond.metric]
      : cond.value;

    details.push({
      metric: cond.metric,
      actual: metrics[cond.metric] != null ? metrics[cond.metric] : null,
      threshold: effectiveThreshold,
      op: cond.op,
      passed,
    });

    if (passed) passCount++;
  }

  // Check for hard fail conditions
  const blockers = [];
  for (const cond of gate.fail) {
    if (_evaluateCondition(cond, metrics, {})) {
      blockers.push(
        `${cond.metric} ${cond.op} ${cond.value} (actual: ${metrics[cond.metric] != null ? metrics[cond.metric] : 'N/A'})`
      );
    }
  }

  // Determine verdict
  let verdict = 'pass';
  if (blockers.length > 0) {
    verdict = 'fail';
  } else if (passCount < totalPass) {
    // Check if any retry conditions match
    const hasRetryMatch = gate.retry.some(cond => _evaluateCondition(cond, metrics, overrides));
    verdict = hasRetryMatch ? 'retry' : (totalPass === 0 ? 'pass' : 'retry');
  }

  // Compute gate score
  const score = totalPass > 0 ? Math.round((passCount / totalPass) * 100) : 100;

  // Build recommendation
  const recommendation = _buildRecommendation(verdict, details, blockers, phase);

  return {
    verdict,
    action: _verdictAction(verdict, phase),
    score,
    details,
    blockers,
    recommendation,
  };
}

/**
 * Build a human-readable recommendation from gate result.
 * @param {'pass'|'retry'|'fail'} verdict
 * @param {GateDetail[]} details
 * @param {string[]} blockers
 * @param {string} phase
 * @returns {string}
 * @private
 */
function _buildRecommendation(verdict, details, blockers, phase) {
  if (verdict === 'pass') {
    return `All quality conditions met for ${phase} phase. Safe to proceed.`;
  }

  const failing = details.filter(d => !d.passed);
  const lines = [];

  if (verdict === 'fail') {
    lines.push(`BLOCKED: ${blockers.length} critical condition(s) failed in ${phase} gate.`);
    for (const b of blockers) {
      lines.push(`  - ${b}`);
    }
  }

  if (failing.length > 0) {
    lines.push(`${failing.length} condition(s) not met:`);
    for (const f of failing) {
      lines.push(
        `  - ${f.metric}: actual=${f.actual != null ? f.actual : 'N/A'}, required ${f.op} ${f.threshold}`
      );
    }
  }

  if (verdict === 'retry') {
    lines.push('Recommendation: Run PDCA Act iteration to address gaps before retrying.');
  } else {
    lines.push('Recommendation: Resolve all blockers before proceeding. Manual review required.');
  }

  return lines.join('\n');
}

/**
 * Get a short action description for a verdict.
 * @param {'pass'|'retry'|'fail'} verdict
 * @param {string} phase
 * @returns {string}
 * @private
 */
function _verdictAction(verdict, phase) {
  switch (verdict) {
    case 'pass': return `Proceed from ${phase}`;
    case 'retry': return `Iterate ${phase} via Act phase`;
    case 'fail': return `Blocked at ${phase} gate`;
    default: return 'Unknown';
  }
}

// ============================================================
// Automation-Aware Action Resolution
// ============================================================

/**
 * Resolve the concrete action based on verdict and automation level.
 *
 * Automation behavior:
 * - 'guide' (L0-L1): Always notify user, never auto-proceed
 * - 'semi' (L2): Auto-branch on pass, iterator on retry, block on fail
 * - 'full' (L3-L4): Auto-proceed on pass+retry, only fail blocks
 *
 * @param {'pass'|'retry'|'fail'} verdict - Gate verdict
 * @param {'guide'|'semi'|'full'} automationLevel - Automation behavior category
 * @param {string} phase - PDCA phase name
 * @returns {'notify'|'auto_branch'|'gate_confirm'|'auto_proceed'|'block'}
 */
function resolveAction(verdict, automationLevel, phase) {
  if (verdict === 'fail') {
    return automationLevel === 'guide' ? 'notify' : 'block';
  }

  if (automationLevel === 'guide') {
    return 'notify';
  }

  if (automationLevel === 'semi') {
    if (verdict === 'pass') return 'auto_branch';
    if (verdict === 'retry') return 'gate_confirm';
    return 'block';
  }

  // full automation
  if (verdict === 'pass') return 'auto_proceed';
  if (verdict === 'retry') return 'auto_proceed';
  return 'block';
}

// ============================================================
// Gate Result Persistence
// ============================================================

/**
 * Path to gate results history file.
 * @returns {string}
 */
function _gateResultsPath() {
  return path.join(STATE_PATHS.state(), 'gate-results.json');
}

/**
 * Record a gate result for audit and trend analysis.
 * @param {string} phase - PDCA phase name
 * @param {GateResult} result - Gate check result
 * @param {string} [feature] - Feature name
 */
function recordGateResult(phase, result, feature) {
  const filePath = _gateResultsPath();
  const current = stateStore.read(filePath) || { results: [] };

  current.results.push({
    phase,
    feature: feature || 'unknown',
    verdict: result.verdict,
    score: result.score,
    blockers: result.blockers,
    timestamp: new Date().toISOString(),
  });

  // FIFO: keep last MAX_QUALITY_HISTORY entries
  if (current.results.length > MAX_QUALITY_HISTORY) {
    current.results = current.results.slice(-MAX_QUALITY_HISTORY);
  }

  stateStore.write(filePath, current);
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  GATE_DEFINITIONS,
  LEVEL_THRESHOLD_OVERRIDES,
  checkGate,
  getEffectiveThresholds,
  recordGateResult,
  resolveAction,
};
