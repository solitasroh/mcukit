/**
 * Explanation Generator - Auto-generate explanations from decision traces
 * @module lib/audit/explanation-generator
 * @version 2.0.0
 *
 * Transforms raw decision traces into human-readable explanations
 * at varying levels of detail for CLI display and reporting.
 *
 * Design Reference: docs/02-design/features/rkit-v200-controllable-ai.design.md
 */

// ============================================================
// Constants
// ============================================================

const DETAIL_LEVELS = ['brief', 'normal', 'detailed'];

const IMPACT_LABELS = {
  low: 'Low impact',
  medium: 'Medium impact',
  high: 'HIGH IMPACT',
  critical: 'CRITICAL IMPACT',
};

const OUTCOME_LABELS = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
};

// ============================================================
// Public API
// ============================================================

/**
 * Generate a human-readable explanation from a decision trace
 * @param {Object} trace - DecisionTrace object
 * @param {string} [detailLevel='normal'] - 'brief' (1 sentence), 'normal' (paragraph), 'detailed' (full trace)
 * @returns {string} Human-readable explanation
 */
function generateExplanation(trace, detailLevel = 'normal') {
  if (!trace) return '';

  const level = DETAIL_LEVELS.includes(detailLevel) ? detailLevel : 'normal';

  // Brief: single sentence
  if (level === 'brief') {
    const action = (trace.decisionType || 'decision').replace(/_/g, ' ');
    return `Decided to ${action}: chose "${trace.chosenOption || 'N/A'}" (confidence: ${formatConfidence(trace.confidence)}).`;
  }

  // Normal: paragraph with rationale
  if (level === 'normal') {
    const lines = [];
    const action = (trace.decisionType || 'decision').replace(/_/g, ' ');
    lines.push(`Decision: ${action}`);
    if (trace.question) {
      lines.push(`Question: ${trace.question}`);
    }
    lines.push(`Chosen: ${trace.chosenOption || 'N/A'}`);
    if (trace.rationale) {
      lines.push(`Rationale: ${trace.rationale}`);
    }
    lines.push(`Confidence: ${formatConfidence(trace.confidence)} | Impact: ${IMPACT_LABELS[trace.impact] || trace.impact || 'unknown'}`);
    return lines.join('\n');
  }

  // Detailed: full trace with alternatives
  const lines = [];
  lines.push(`=== Decision Trace: ${trace.id || 'unknown'} ===`);
  lines.push(`Timestamp: ${trace.timestamp || 'N/A'}`);
  lines.push(`Session: ${trace.sessionId || 'N/A'}`);
  lines.push(`Feature: ${trace.feature || 'N/A'} | Phase: ${trace.phase || 'N/A'}`);
  lines.push(`Automation Level: ${trace.automationLevel != null ? trace.automationLevel : 'N/A'}/4`);
  lines.push('');
  lines.push(`Type: ${(trace.decisionType || 'unknown').replace(/_/g, ' ')}`);
  if (trace.question) {
    lines.push(`Question: ${trace.question}`);
  }
  lines.push(`Chosen Option: ${trace.chosenOption || 'N/A'}`);
  lines.push(`Rationale: ${trace.rationale || 'None provided'}`);
  lines.push(`Confidence: ${formatConfidence(trace.confidence)} | Impact: ${IMPACT_LABELS[trace.impact] || trace.impact || 'unknown'}`);
  lines.push(`Reversible: ${trace.reversible ? 'Yes' : 'No'}`);

  if (trace.outcome) {
    lines.push(`Outcome: ${OUTCOME_LABELS[trace.outcome] || trace.outcome}`);
  }

  // Alternatives
  if (Array.isArray(trace.alternatives) && trace.alternatives.length > 0) {
    lines.push('');
    lines.push('Alternatives considered:');
    for (const alt of trace.alternatives) {
      lines.push(`  - ${alt.option || 'unnamed'}: ${alt.reason || 'no reason'}`);
      if (alt.rejectedBecause) {
        lines.push(`    Rejected: ${alt.rejectedBecause}`);
      }
    }
  }

  // Affected files
  if (Array.isArray(trace.affectedFiles) && trace.affectedFiles.length > 0) {
    lines.push('');
    lines.push(`Affected files (${trace.affectedFiles.length}):`);
    for (const f of trace.affectedFiles) {
      lines.push(`  - ${f}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a decision trace for CLI-friendly display
 * @param {Object} trace - DecisionTrace object
 * @returns {string} Compact CLI-formatted string
 */
function formatDecisionForDisplay(trace) {
  if (!trace) return '';

  const type = (trace.decisionType || 'unknown').replace(/_/g, ' ');
  const time = trace.timestamp ? trace.timestamp.slice(11, 19) : '--:--:--';
  const impact = trace.impact ? `[${trace.impact.toUpperCase()}]` : '';
  const confidence = formatConfidence(trace.confidence);
  const reversible = trace.reversible ? '' : ' [IRREVERSIBLE]';

  return `${time} | ${type} ${impact} | "${trace.chosenOption || 'N/A'}" (${confidence})${reversible}`;
}

/**
 * Summarize multiple decision traces into a readable report
 * @param {Object[]} traces - Array of DecisionTrace objects
 * @returns {string} Multi-line summary report
 */
function summarizeDecisionHistory(traces) {
  if (!Array.isArray(traces) || traces.length === 0) {
    return 'No decisions recorded.';
  }

  const lines = [];
  lines.push(`Decision History: ${traces.length} decision(s)`);
  lines.push('');

  // Group by phase
  const byPhase = {};
  for (const t of traces) {
    const phase = t.phase || 'unknown';
    if (!byPhase[phase]) byPhase[phase] = [];
    byPhase[phase].push(t);
  }

  for (const [phase, phaseTraces] of Object.entries(byPhase)) {
    lines.push(`[${phase.toUpperCase()}] (${phaseTraces.length} decisions)`);
    for (const t of phaseTraces) {
      lines.push(`  ${formatDecisionForDisplay(t)}`);
    }
    lines.push('');
  }

  // Stats
  const avgConfidence = traces.reduce((sum, t) => sum + (t.confidence || 0), 0) / traces.length;
  const irreversible = traces.filter(t => !t.reversible).length;
  const highImpact = traces.filter(t => t.impact === 'high' || t.impact === 'critical').length;

  lines.push('--- Stats ---');
  lines.push(`Avg confidence: ${formatConfidence(avgConfidence)}`);
  lines.push(`Irreversible: ${irreversible}/${traces.length}`);
  lines.push(`High/Critical impact: ${highImpact}/${traces.length}`);

  return lines.join('\n');
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Format confidence value as percentage string
 * @param {number} confidence - 0.0-1.0
 * @returns {string} e.g. "85%"
 */
function formatConfidence(confidence) {
  if (typeof confidence !== 'number' || isNaN(confidence)) return 'N/A';
  return `${Math.round(confidence * 100)}%`;
}

// ============================================================
// Module Exports
// ============================================================

module.exports = {
  generateExplanation,
  formatDecisionForDisplay,
  summarizeDecisionHistory,
  // Constants (for external use)
  DETAIL_LEVELS,
};
