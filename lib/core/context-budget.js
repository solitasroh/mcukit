/**
 * Context Budget Guard — rkit Cycle 2 candidate A partial_adopt
 *
 * Sourced from bkit-claude-code/lib/core/context-budget.js (cycle 2 sync).
 * Behavior preserved; only debug import path adjusted to rkit lib/core/debug.js
 * (rkit-equivalent module exists, council enterprise-expert evidence).
 *
 * Claude Code hooks cap additionalContext at 10,000 characters per
 * https://docs.claude.com/en/docs/claude-code/hooks — overflow is sent to
 * a file and replaced with a preview. This module truncates pre-emptively
 * with a 2,000-char safety margin (default cap 8,000), preserving priority
 * sections (MANDATORY/Previous Work/AskUserQuestion).
 *
 * Council validation:
 *   - security: zero external egress (verified via verify-policy network-egress)
 *   - code-analyzer: no rkit responsibility overlap (context-budget is novel
 *     functionality not present in audit/quality/team/skills modules)
 */

const { debugLog } = require('./debug');

// ANSI escape sequence stripper (display-length basis for hooks output)
const ANSI_REGEX = /[][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
function stripAnsi(str) {
  return typeof str === 'string' ? str.replace(ANSI_REGEX, '') : str;
}

const DEFAULT_MAX_CHARS = 8000;
const DEFAULT_PRIORITY_KEYS = [
  'MANDATORY',
  'Previous Work Detected',
  'Previous Work',
  'AskUserQuestion',
];
const TRUNCATION_NOTICE = '\n\n⚠️ rkit: additionalContext truncated (context-budget guard).\n';

/**
 * Enforce a character budget on a hook output string, preserving priority
 * sections.
 *
 * @param {string} input - additionalContext string to guard
 * @param {object} [opts]
 * @param {number} [opts.maxChars=8000] - Max chars (stripAnsi basis)
 * @param {string[]} [opts.priorityPreserve] - Keywords marking priority sections
 * @returns {string} possibly truncated context
 */
function applyBudget(input, opts) {
  const options = opts || {};
  const maxChars = Number.isFinite(options.maxChars) ? options.maxChars : DEFAULT_MAX_CHARS;
  const priorityKeys = Array.isArray(options.priorityPreserve)
    ? options.priorityPreserve
    : DEFAULT_PRIORITY_KEYS;

  const original = String(input == null ? '' : input);
  const strippedLen = stripAnsi(original).length;

  if (strippedLen <= maxChars) return original;

  if (typeof debugLog === 'function') {
    debugLog('ContextBudget', 'cap exceeded', {
      original: strippedLen,
      cap: maxChars,
      overshoot: strippedLen - maxChars,
    });
  }

  const sections = original.split(/\n\n+/);

  const priorityIdx = new Set();
  sections.forEach((s, i) => {
    if (priorityKeys.some((k) => s.includes(k))) priorityIdx.add(i);
  });

  const kept = new Array(sections.length).fill(false);
  let budget = maxChars - stripAnsi(TRUNCATION_NOTICE).length;

  // Reserve priority sections first
  for (const i of priorityIdx) {
    const segLen = stripAnsi(sections[i]).length + 2;
    if (budget - segLen >= 0) {
      kept[i] = true;
      budget -= segLen;
    }
  }

  // Fill remaining budget from front (preserve header/onboarding)
  for (let i = 0; i < sections.length; i++) {
    if (kept[i]) continue;
    const segLen = stripAnsi(sections[i]).length + 2;
    if (budget - segLen >= 0) {
      kept[i] = true;
      budget -= segLen;
    } else {
      break;
    }
  }

  return sections.filter((_, i) => kept[i]).join('\n\n') + TRUNCATION_NOTICE;
}

module.exports = {
  applyBudget,
  DEFAULT_MAX_CHARS,
  DEFAULT_PRIORITY_KEYS,
  // Internal helpers exposed for testing only
  _stripAnsi: stripAnsi,
};
