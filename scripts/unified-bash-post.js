#!/usr/bin/env node
/**
 * unified-bash-post.js - Unified Bash PostToolUse Handler (v1.4.4)
 *
 * GitHub Issue #9354 Workaround:
 * Consolidates Bash PostToolUse hooks from:
 * - qa-monitor: qa-monitor-post.js
 */

const { readStdinSync, parseHookInput, outputAllow } = require('../lib/core/io');
const { debugLog } = require('../lib/core/debug');
const { getActiveSkill, getActiveAgent } = require('../lib/task/context');

// ============================================================
// Handler: qa-monitor-post (Bash)
// ============================================================

/**
 * QA monitor Bash command tracking
 * @param {Object} input - Hook input
 * @returns {boolean} True if executed
 */
function handleQaMonitorBashPost(input) {
  const { command } = parseHookInput(input);
  if (!command) return false;

  // Log docker/curl commands for QA analysis
  const qaRelevantPatterns = ['docker', 'curl', 'npm test', 'jest', 'pytest', 'go test'];

  for (const pattern of qaRelevantPatterns) {
    if (command.includes(pattern)) {
      debugLog('UnifiedBashPost', 'QA relevant command executed', {
        pattern,
        command: command.substring(0, 100)
      });
      break;
    }
  }

  return true;
}

// ============================================================
// Main Execution
// ============================================================

debugLog('UnifiedBashPost', 'Hook started');

// Read hook context
let input = {};
try {
  input = readStdinSync();
  if (typeof input === 'string') {
    input = JSON.parse(input);
  }
} catch (e) {
  debugLog('UnifiedBashPost', 'Failed to parse input', { error: e.message });
}

// Get current context
const activeSkill = getActiveSkill();
const activeAgent = getActiveAgent();

debugLog('UnifiedBashPost', 'Context', { activeSkill, activeAgent });

// Only qa-monitor has Bash PostToolUse handler
if (activeAgent === 'qa-monitor') {
  handleQaMonitorBashPost(input);
}

// v2.0.0: Audit logging for bash commands
try {
  const toolInput = input.tool_input || {};
  const command = toolInput.command || '';
  const audit = require('../lib/audit/audit-logger');
  audit.writeAuditLog({
    actor: 'system', actorId: 'unified-bash-post',
    action: 'command_executed',
    category: 'bash',
    target: command.substring(0, 200), targetType: 'command',
    result: 'success', destructiveOperation: false
  });
} catch (_) {}

// v2.0.0: Loop detection for repeated commands
try {
  const toolInput = input.tool_input || {};
  const command = toolInput.command || '';
  const lb = require('../lib/control/loop-breaker');
  lb.recordAction('bash_command', command.substring(0, 100));
  const loopCheck = lb.checkLoop();
  if (loopCheck.detected) {
    debugLog('UnifiedBashPost', 'Loop detected in bash commands', {
      command: command.substring(0, 100), details: loopCheck
    });
  }
} catch (_) {}

// Output allow (PostToolUse doesn't block)
outputAllow('', 'PostToolUse');

debugLog('UnifiedBashPost', 'Hook completed');
