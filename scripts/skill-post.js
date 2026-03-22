#!/usr/bin/env node
/**
 * Skill Post-execution Hook (v1.4.4)
 *
 * Called from PostToolUse(Skill) hook.
 * Uses skill-orchestrator to suggest next steps.
 *
 * @version 1.6.0
 * @module scripts/skill-post
 */

const path = require('path');
const { debugLog } = require('../lib/core/debug');
const { setActiveSkill } = require('../lib/task/context');
const { getPdcaStatusFull, updatePdcaStatus } = require('../lib/pdca/status');

// Lazy load modules
let orchestrator = null;

function getOrchestrator() {
  if (!orchestrator) {
    orchestrator = require('../lib/skill-orchestrator.js');
  }
  return orchestrator;
}

/**
 * Parse skill invocation from tool input
 * @param {Object} toolInput - Tool input from hook context
 * @returns {{ skillName: string, args: Object }}
 */
function parseSkillInvocation(toolInput) {
  try {
    const skillName = toolInput?.skill || '';
    const argsStr = toolInput?.args || '';

    // Parse args string into structured format
    const args = {};
    if (argsStr) {
      const parts = argsStr.split(/\s+/);
      if (parts.length > 0) {
        args.action = parts[0];
      }
      if (parts.length > 1) {
        args.feature = parts.slice(1).join(' ');
      }
    }

    return { skillName, args };
  } catch (e) {
    return { skillName: '', args: {} };
  }
}

/**
 * Format next step message for output
 * @param {Object} suggestions - Suggestions from orchestrator
 * @param {string} skillName - Current skill name
 * @returns {string} Formatted message
 */
function formatNextStepMessage(suggestions, skillName) {
  const lines = [];

  lines.push(`\n--- Skill Post-execution: ${skillName} ---\n`);

  if (suggestions.nextSkill) {
    lines.push(`\nSuggested next step:`);
    lines.push(`   /${suggestions.nextSkill.name}`);
    lines.push(`   ${suggestions.nextSkill.message}`);
  }

  if (suggestions.suggestedAgent) {
    lines.push(`\nRecommended Agent:`);
    lines.push(`   ${suggestions.suggestedAgent}`);
    lines.push(`   ${suggestions.suggestedMessage}`);
  }

  if (!suggestions.nextSkill && !suggestions.suggestedAgent) {
    lines.push(`\nSkill execution complete. Proceed to the next task.`);
  }

  return lines.join('\n');
}

/**
 * v1.5.6: Determine if a skill generates code.
 * List of skills eligible for /copy command guidance.
 * @param {string} skillName - Skill name
 * @returns {boolean}
 */
const CODE_GENERATION_SKILLS = [
  'phase-4-api',
  'phase-5-design-system',
  'phase-6-ui-integration',
  'code-review',
  'starter',
  'dynamic',
  'enterprise',
  'mobile-app',
  'desktop-app'
];

function shouldSuggestCopy(skillName) {
  return CODE_GENERATION_SKILLS.includes(skillName);
}

/**
 * Generate JSON output for Claude Code
 * @param {Object} suggestions - Suggestions from orchestrator
 * @param {string} skillName - Current skill name
 * @returns {Object} JSON output
 */
function generateJsonOutput(suggestions, skillName) {
  const output = {
    skillCompleted: skillName,
    timestamp: new Date().toISOString()
  };

  if (suggestions.nextSkill) {
    output.nextSkill = suggestions.nextSkill.name;
    output.nextSkillMessage = suggestions.nextSkill.message;
  }

  if (suggestions.suggestedAgent) {
    output.suggestedAgent = suggestions.suggestedAgent;
    output.suggestedAgentMessage = suggestions.suggestedMessage;
  }

  // v1.5.6: /copy command guidance (on code generation skill completion)
  if (shouldSuggestCopy(skillName)) {
    output.copyHint = 'Use /copy to select and copy code blocks to clipboard';
  }

  return output;
}

/**
 * Main execution
 */
async function main() {
  const orch = getOrchestrator();

  try {
    // Read hook input from stdin
    let input = '';
    if (process.stdin.isTTY === false) {
      const chunks = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      input = Buffer.concat(chunks).toString('utf8');
    }

    // Parse hook context
    let hookContext = {};
    try {
      if (input.trim()) {
        hookContext = JSON.parse(input);
      }
    } catch (e) {
      debugLog('SkillPost', 'Failed to parse hook input', { error: e.message });
    }

    // Extract skill info from tool_input
    const toolInput = hookContext.tool_input || {};
    const { skillName, args } = parseSkillInvocation(toolInput);

    if (!skillName) {
      debugLog('SkillPost', 'No skill name found in context');
      console.log(JSON.stringify({ status: 'skip', reason: 'no skill name' }));
      return;
    }

    debugLog('SkillPost', 'Processing skill post-execution', { skillName, args });

    // v1.4.4: Set active skill for unified hooks (GitHub #9354 workaround)
    setActiveSkill(skillName);
    debugLog('SkillPost', 'Active skill set for unified hooks', { skillName });

    // Get orchestration result
    const result = await orch.orchestrateSkillPost(skillName, {}, { args });
    const suggestions = result.suggestions || {};

    // Claude Code: JSON output
    const output = generateJsonOutput(suggestions, skillName);
    output.status = 'success';
    console.log(JSON.stringify(output, null, 2));

    // v2.0.0: Audit logging for skill execution
    try {
      const audit = require('../lib/audit/audit-logger');
      audit.writeAuditLog({
        actor: 'system', actorId: 'skill-post',
        action: 'skill_executed',
        category: 'skill',
        target: skillName, targetType: 'skill',
        result: 'success', destructiveOperation: false
      });
    } catch (_) {}

    // v2.0.0: Decision tracing when skills make PDCA phase decisions
    try {
      const skillCfg = orch.getSkillConfig(skillName);
      if (skillCfg && skillCfg['pdca-phase']) {
        const dt = require('../lib/audit/decision-tracer');
        const feature = args.feature || getPdcaStatusFull()?.currentFeature || '';
        dt.recordDecision({
          feature,
          phase: skillCfg['pdca-phase'],
          decisionType: 'phase_transition',
          question: `Skill ${skillName} completed - advance PDCA phase?`,
          chosenOption: `Advance to ${skillCfg['pdca-phase']}`,
          rationale: `Skill ${skillName} maps to pdca-phase ${skillCfg['pdca-phase']}`,
          confidence: 0.9,
          impact: 'medium',
          affectedFiles: [],
          reversible: true
        });
      }
    } catch (_) {}

    // Update PDCA status if skill has pdca-phase
    const skillConfig = orch.getSkillConfig(skillName);
    if (skillConfig && skillConfig['pdca-phase']) {
      const phase = skillConfig['pdca-phase'];
      const feature = args.feature || getPdcaStatusFull()?.currentFeature;

      if (feature) {
        updatePdcaStatus(phase, feature);
        debugLog('SkillPost', 'PDCA status updated', { phase, feature });
      }
    }

  } catch (e) {
    debugLog('SkillPost', 'Error in post-execution', { error: e.message });
    console.log(JSON.stringify({
      status: 'error',
      error: e.message
    }));
  }
}

// Run main
main().catch(e => {
  console.error('skill-post.js fatal error:', e.message);
  process.exit(1);
});
