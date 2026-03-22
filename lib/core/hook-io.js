/**
 * Lightweight Hook I/O
 * @module lib/core/hook-io
 * @version 2.0.0
 *
 * Minimal I/O primitives for hook scripts.
 * Replaces the need to require common.js or the full core/io module
 * in simple hook scripts that only need stdin/stdout operations.
 *
 * For full I/O features (truncateContext, xmlSafeOutput, readStdin async),
 * use lib/core/io instead.
 */

const fs = require('fs');

// ============================================================
// stdin
// ============================================================

/**
 * Read and parse JSON from stdin synchronously.
 * Returns empty object on parse failure or empty input.
 *
 * @returns {Object} Parsed JSON input from stdin
 */
function readStdinSync() {
  try {
    const input = fs.readFileSync(0, 'utf8');
    return JSON.parse(input);
  } catch (e) {
    return {};
  }
}

/**
 * Parse raw hook input into a normalized structure.
 * Handles both snake_case (Claude Code native) and camelCase field names.
 *
 * @param {Object} raw - Raw hook input object from stdin
 * @returns {{ toolName: string, filePath: string, content: string, command: string, oldString: string }}
 */
function parseHookInput(raw) {
  const input = raw || {};
  return {
    toolName: input.tool_name || input.toolName || '',
    filePath: input.tool_input?.file_path || input.tool_input?.filePath || '',
    content: input.tool_input?.content || '',
    command: input.tool_input?.command || '',
    oldString: input.tool_input?.old_string || '',
  };
}

// ============================================================
// stdout (Hook Responses)
// ============================================================

/**
 * Output an "allow" decision and exit.
 * For PreToolUse/PostToolUse hooks that approve the operation.
 *
 * @param {string} [context] - Optional context message (max ~500 chars recommended)
 */
function outputAllow(context) {
  if (context) {
    console.log(typeof context === 'string' ? context : JSON.stringify(context));
  }
}

/**
 * Output a "block" decision and exit.
 * For PreToolUse hooks that reject the operation.
 *
 * @param {string} message - Reason for blocking
 */
function outputBlock(message) {
  console.log(JSON.stringify({
    decision: 'block',
    reason: message,
  }));
  process.exit(0);
}

/**
 * Output nothing (empty response).
 * For hooks that need no output (e.g., PostToolUse observers).
 */
function outputEmpty() {
  // Intentionally empty — Claude Code treats no output as "allow"
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  readStdinSync,
  parseHookInput,
  outputAllow,
  outputBlock,
  outputEmpty,
};
