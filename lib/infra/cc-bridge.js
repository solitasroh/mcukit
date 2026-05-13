/**
 * CC Payload Bridge — Infrastructure Adapter.
 *
 * Cycle 2 F partial_adopt — sourced from bkit lib/infra/cc-bridge.js.
 * Centralizes CC hook stdin parsing, version detection, session_id extraction,
 * bypass-mode flag so hook scripts stop duplicating this logic.
 *
 * Safety: fail-open — parse errors return null or defaults. Hooks must tolerate.
 * No network egress. `claude --version` is a local subprocess (no HTTP/socket).
 *
 * @module lib/infra/cc-bridge
 */

/**
 * Parse raw stdin JSON into a HookInput object.
 * @param {string} rawStdin
 * @returns {Object|null}
 */
function parseHookInput(rawStdin) {
  if (rawStdin === undefined || rawStdin === null) return null;
  const text = String(rawStdin).trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return null;
  } catch (_e) {
    return null;
  }
}

/**
 * Detect the current Claude Code CLI version.
 * Priority: CLAUDE_CODE_VERSION env → `claude --version` subprocess → null.
 * @returns {string|null}
 */
function detectCCVersion() {
  const envV = process.env.CLAUDE_CODE_VERSION;
  if (envV && /^\d+\.\d+\.\d+/.test(envV)) return envV;

  try {
    const { execSync } = require('child_process');
    const out = execSync('claude --version 2>/dev/null', {
      encoding: 'utf8',
      timeout: 2000,
    });
    const m = String(out).match(/(\d+\.\d+\.\d+(?:-\S+)?)/);
    if (m) return m[1];
  } catch (_e) { /* ignore */ }

  return null;
}

/**
 * Extract session identifier from a HookInput.
 * @param {Object|null} input
 * @returns {string|null}
 */
function getSessionId(input) {
  if (!input || typeof input !== 'object') return null;
  if (typeof input.session_id === 'string' && input.session_id.length > 0) return input.session_id;
  if (typeof input.sessionId === 'string' && input.sessionId.length > 0) return input.sessionId;
  return process.env.CLAUDE_SESSION_ID || null;
}

/**
 * Check if rkit's CC regression defense should be bypassed.
 * Controlled by RKIT_CC_REGRESSION_BYPASS env var.
 * @returns {boolean}
 */
function isBypassMode() {
  const v = process.env.RKIT_CC_REGRESSION_BYPASS;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Extract best-effort tool name from a PreToolUse-style input.
 * @param {Object|null} input
 * @returns {string|null}
 */
function getToolName(input) {
  if (!input || typeof input !== 'object') return null;
  return (typeof input.tool_name === 'string' && input.tool_name) || null;
}

/**
 * Extract permission flags (bypassPermissions, dangerouslyDisableSandbox).
 * @param {Object|null} input
 * @returns {{ bypassPermissions: boolean, dangerouslyDisableSandbox: boolean }}
 */
function getPermissionFlags(input) {
  const out = { bypassPermissions: false, dangerouslyDisableSandbox: false };
  if (!input || typeof input !== 'object') return out;
  const p = input.permissions || {};
  out.bypassPermissions = Boolean(p.bypassPermissions);
  out.dangerouslyDisableSandbox = Boolean(p.dangerouslyDisableSandbox);
  return out;
}

/**
 * Detect hook event name (matches CC `hook_event_name` field).
 * @param {Object|null} input
 * @returns {string|null}
 */
function getHookEventName(input) {
  if (!input || typeof input !== 'object') return null;
  return (typeof input.hook_event_name === 'string' && input.hook_event_name) || null;
}

module.exports = {
  parseHookInput,
  detectCCVersion,
  getSessionId,
  isBypassMode,
  getToolName,
  getPermissionFlags,
  getHookEventName,
};
