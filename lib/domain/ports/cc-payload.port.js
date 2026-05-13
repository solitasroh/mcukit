/**
 * CCPayloadPort — Type-only Port for Claude Code hook payload handling.
 *
 * rkit Cycle 3 CR-2 partial_adopt. Sourced from bkit
 * lib/domain/ports/cc-payload.port.js. Type-only contract — no runtime
 * behavior. Implementation: rkit lib/infra/cc-bridge.js (cycle 2 F adopted).
 *
 * @module lib/domain/ports/cc-payload
 */

/**
 * @typedef {Object} HookInput
 * @property {string} [session_id] - CC session UUID
 * @property {string} [sessionId] - Alternate camelCase form
 * @property {string} [hook_event_name] - Hook event (SessionStart, PreToolUse, ...)
 * @property {string} [tool_name] - Tool invoked (PreToolUse only)
 * @property {Object} [permissions] - { bypassPermissions, dangerouslyDisableSandbox }
 * @property {string} [transcript_path] - Path to current transcript jsonl
 */

/**
 * @typedef {Object} CCPayloadPort
 * @property {(rawStdin: string) => HookInput|null} parseHookInput
 * @property {() => string|null} detectCCVersion
 * @property {(input: HookInput|null) => string|null} getSessionId
 * @property {() => boolean} isBypassMode
 * @property {(input: HookInput|null) => string|null} getToolName
 * @property {(input: HookInput|null) => {bypassPermissions: boolean, dangerouslyDisableSandbox: boolean}} getPermissionFlags
 * @property {(input: HookInput|null) => string|null} getHookEventName
 */

module.exports = {};
