/**
 * PDCA Automation Module
 * @module lib/pdca/automation
 * @version 1.6.0
 */

// Lazy require
let _core = null;
function getCore() {
  if (!_core) {
    _core = require('../core');
  }
  return _core;
}

let _status = null;
function getStatus() {
  if (!_status) {
    _status = require('./status');
  }
  return _status;
}

/**
 * Get automation level from config/env
 * @returns {'manual' | 'semi-auto' | 'full-auto'}
 */
function getAutomationLevel() {
  const { getConfig } = getCore();
  const envLevel = process.env.MCUKIT_PDCA_AUTOMATION;
  if (envLevel && ['manual', 'semi-auto', 'full-auto'].includes(envLevel)) {
    return envLevel;
  }
  return getConfig('pdca.automationLevel', 'semi-auto');
}

/**
 * Check if full-auto mode is enabled
 * @returns {boolean}
 */
function isFullAutoMode() {
  return getAutomationLevel() === 'full-auto';
}

/**
 * Check if should auto-advance for given phase
 * @param {string} phase
 * @returns {boolean}
 */
function shouldAutoAdvance(phase) {
  const { getConfig } = getCore();
  const level = getAutomationLevel();

  if (level === 'manual') return false;

  const reviewCheckpoints = getConfig('pdca.fullAuto.reviewCheckpoints', ['design']);

  if (level === 'full-auto') {
    return !reviewCheckpoints.includes(phase);
  }

  // semi-auto: only auto-advance from check to act (when matchRate < 90)
  return phase === 'check';
}

/**
 * Generate auto-trigger for next phase
 * @param {string} currentPhase
 * @param {Object} context
 * @returns {Object|null}
 */
function generateAutoTrigger(currentPhase, context = {}) {
  if (!shouldAutoAdvance(currentPhase)) return null;

  const phaseMap = {
    pm: { skill: 'pdca', args: `plan ${context.feature}` },
    plan: { skill: 'pdca', args: `design ${context.feature}` },
    design: { skill: 'pdca', args: `do ${context.feature}` },
    do: { skill: 'pdca', args: `analyze ${context.feature}` },
    check: context.matchRate >= 90
      ? { skill: 'pdca', args: `report ${context.feature}` }
      : { skill: 'pdca', args: `iterate ${context.feature}` },
    act: { skill: 'pdca', args: `analyze ${context.feature}` },
  };

  return phaseMap[currentPhase] || null;
}

/**
 * v1.5.7: Generate batch trigger for multiple features
 * @param {string[]} features - Feature names to batch process
 * @param {string} phase - Target PDCA phase
 * @returns {Object|null}
 */
function generateBatchTrigger(features, phase) {
  if (!Array.isArray(features) || features.length < 2) return null;

  const { debugLog } = getCore();

  debugLog('PDCA', 'Batch trigger generated', {
    featureCount: features.length,
    phase
  });

  return {
    type: 'batch',
    features,
    phase,
    commands: features.map(f => ({
      skill: 'pdca',
      args: `${phase} ${f}`
    }))
  };
}

/**
 * v1.5.7: Check if batch mode is appropriate
 * @param {Object} context - Current context with activeFeatures
 * @returns {boolean}
 */
function shouldSuggestBatch(context = {}) {
  const { getPdcaStatusFull } = getStatus();
  const status = getPdcaStatusFull();
  const activeFeatures = status?.activeFeatures || [];

  return activeFeatures.length >= 2;
}

/**
 * Check if PDCA should auto-start based on task
 * @param {string} feature
 * @param {Object} taskClassification
 * @returns {boolean}
 */
function shouldAutoStartPdca(feature, taskClassification) {
  const { getConfig } = getCore();
  const { getPdcaStatusFull } = getStatus();

  // Don't auto-start if already in progress
  const status = getPdcaStatusFull();
  if (status?.features?.[feature]) return false;

  // Check task size threshold
  const threshold = getConfig('pdca.autoStartThreshold', 100);
  const lineCount = taskClassification?.lines || 0;

  return lineCount >= threshold;
}

/**
 * Auto-advance PDCA phase based on result
 * @param {string} feature
 * @param {string} currentPhase
 * @param {Object} result
 * @returns {Object|null}
 */
function autoAdvancePdcaPhase(feature, currentPhase, result = {}) {
  const { debugLog, getConfig } = getCore();
  const { updatePdcaStatus } = getStatus();

  if (!shouldAutoAdvance(currentPhase)) {
    debugLog('PDCA', 'Auto-advance skipped', { phase: currentPhase });
    return null;
  }

  const nextPhaseMap = {
    pm: 'plan',
    plan: 'design',
    design: 'do',
    do: 'check',
    check: result.matchRate >= 90 ? 'report' : 'act',
    act: 'check'
  };

  const nextPhase = nextPhaseMap[currentPhase];
  if (!nextPhase) return null;

  updatePdcaStatus(feature, nextPhase, {
    previousPhase: currentPhase,
    autoAdvanced: true
  });

  debugLog('PDCA', 'Auto-advanced phase', {
    feature,
    from: currentPhase,
    to: nextPhase
  });

  return {
    feature,
    phase: nextPhase,
    trigger: generateAutoTrigger(currentPhase, { feature, ...result })
  };
}

/**
 * Get hook context for automation
 * @returns {Object}
 */
function getHookContext() {
  const { MCUKIT_PLATFORM, PROJECT_DIR, PLUGIN_ROOT } = getCore();

  return {
    platform: MCUKIT_PLATFORM,
    projectDir: PROJECT_DIR,
    pluginRoot: PLUGIN_ROOT,
    automationLevel: getAutomationLevel(),
    isFullAuto: isFullAutoMode()
  };
}

/**
 * Format user prompt output
 * @param {Object} options
 * @returns {string}
 */
function emitUserPrompt(options = {}) {
  const { message, feature, phase, suggestions } = options;

  let output = '';

  if (message) {
    output += message + '\n';
  }

  if (feature && phase) {
    output += `\n📍 Current: ${feature} (${phase})\n`;
  }

  if (suggestions?.length) {
    output += '\n💡 Suggestions:\n';
    suggestions.forEach((s, i) => {
      output += `  ${i + 1}. ${s}\n`;
    });
  }

  return output;
}

/**
 * Format ask user question payload
 * v1.5.9: Added preview field support (ENH-78 graceful degradation)
 * v1.6.0: ENH-92 AskUserQuestion preview performance optimized (CC v2.1.70 fix)
 * @param {Object} payload
 * @returns {Object}
 */
function formatAskUserQuestion(payload) {
  const defaultOptions = [
    { label: 'Continue', description: 'Proceed with current task' },
    { label: 'Skip', description: 'Skip this step' }
  ];

  const options = (payload.options || defaultOptions).map(opt => {
    const result = {
      label: opt.label,
      description: opt.description
    };
    // v1.5.9: preview field (CC v2.1.69+, silently ignored on older versions)
    // v1.6.0: ENH-92 performance improved by CC v2.1.70 AskUserQuestion preview fix
    if (opt.preview) {
      result.preview = opt.preview;
    }
    return result;
  });

  // v1.6.0 ENH-92: Include executive summary in preview when available
  if (payload.executiveSummary && options.length > 0 && !options[0].preview) {
    const es = payload.executiveSummary;
    options[0].preview = [
      '## Executive Summary',
      '',
      `**Problem**: ${es.problem || 'N/A'}`,
      `**Solution**: ${es.solution || 'N/A'}`,
      `**Impact**: ${es.impact || 'N/A'}`,
      `**Value**: ${es.value || 'N/A'}`
    ].join('\n');
  }

  return {
    questions: [
      {
        question: payload.question || 'How would you like to proceed?',
        header: payload.header || 'Action',
        options,
        multiSelect: payload.multiSelect || false
      }
    ]
  };
}

/**
 * v1.5.9: Build PDCA phase-specific Next Action AskUserQuestion
 * @param {string} phase - Completed PDCA phase ('plan'|'plan-plus'|'report'|'check')
 * @param {string} feature - Feature name
 * @param {Object} [context] - Additional context (matchRate, iterCount)
 * @returns {Object} formatAskUserQuestion compatible payload
 */
function buildNextActionQuestion(phase, feature, context = {}) {
  const { matchRate = 0, iterCount = 0 } = context;

  const questionSets = {
    'pm': {
      question: 'PM analysis completed. Please select next step.',
      header: 'PM Complete',
      options: [
        {
          label: 'Start Plan (Recommended)',
          description: 'Create Plan document with PRD auto-reference',
          preview: [
            '## Plan Phase',
            '',
            `**Command**: \`/pdca plan ${feature}\``,
            '',
            `**PRD Auto-Reference**: docs/00-pm/${feature}.prd.md`,
            '',
            '**Duration**: 15-30 min',
            '',
            '**PDCA Status**:',
            '[PM] OK -> **[Plan]** -> [Design] -> [Do] -> [Check]'
          ].join('\n')
        },
        {
          label: 'Re-run PM Analysis',
          description: 'Run PM analysis again with different parameters',
          preview: [
            '## Re-run PM',
            '',
            `**Command**: \`/pdca pm ${feature}\``,
            '',
            '**Note**: Existing PRD will be overwritten'
          ].join('\n')
        },
        {
          label: 'Skip to Plan-Plus',
          description: 'Use brainstorming-enhanced planning instead',
          preview: [
            '## Plan Plus',
            '',
            `**Command**: \`/plan-plus ${feature}\``,
            '',
            '**Note**: PRD from PM will still be auto-referenced'
          ].join('\n')
        }
      ]
    },

    'plan-plus': {
      question: 'Plan Plus completed. Please select next step.',
      header: 'Next Action',
      options: [
        {
          label: 'Start Design (Recommended)',
          description: 'Start technical design document',
          preview: [
            '## Design Phase',
            '',
            `**Command**: \`/pdca design ${feature}\``,
            '',
            '**Duration**: 20-40 min',
            '',
            '**Output**:',
            `- \`docs/02-design/features/${feature}.design.md\``,
            '- API endpoint specs',
            '- DB schema and data model',
            '- UI component structure'
          ].join('\n')
        },
        {
          label: 'Revise Plan',
          description: 'Apply changes to current plan document',
          preview: [
            '## Revise Plan',
            '',
            `**Target**: \`docs/01-plan/features/${feature}.plan.md\``,
            '',
            '**Key areas**:',
            '- Scope (In/Out) adjustment',
            '- Add/remove functional requirements',
            '- Redefine success criteria'
          ].join('\n')
        },
        {
          label: 'Request Team Review',
          description: 'Request CTO Team plan review',
          preview: [
            '## CTO Team Review',
            '',
            `**Command**: \`/pdca team ${feature}\``,
            '',
            '**Requires**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`',
            '',
            '**Duration**: 10-20 min'
          ].join('\n')
        }
      ]
    },

    'plan': {
      question: 'Plan completed. Please select next step.',
      header: 'Next Action',
      options: [
        {
          label: 'Start Design (Recommended)',
          description: 'Start technical design based on plan',
          preview: [
            '## Design Phase',
            '',
            `**Command**: \`/pdca design ${feature}\``,
            '',
            '**Duration**: 15-30 min',
            '',
            '**PDCA Status**:',
            '[Plan] OK -> **[Design]** -> [Do] -> [Check]'
          ].join('\n')
        },
        {
          label: 'Revise Plan',
          description: 'Apply additional changes to plan',
          preview: [
            '## Revise Plan',
            '',
            `**Target**: \`docs/01-plan/features/${feature}.plan.md\``,
            '',
            '**Tip**: For major scope changes, consider `/plan-plus` restart'
          ].join('\n')
        },
        {
          label: 'Other Feature First',
          description: 'Pause this feature, work on something else',
          preview: [
            '## Pause Feature',
            '',
            `**Current state**: ${feature} saved at "plan" phase`,
            '',
            `**Resume**: \`/pdca status\` then \`/pdca design ${feature}\``
          ].join('\n')
        }
      ]
    },

    'report': {
      question: `Report completed (Match Rate: ${matchRate}%). Please select next step.`,
      header: 'PDCA Complete',
      options: [
        {
          label: 'Archive (Recommended)',
          description: 'Archive completed PDCA documents',
          preview: [
            '## Archive',
            '',
            `**Command**: \`/pdca archive ${feature}\``,
            '',
            '**Documents** (4 files):',
            '- plan.md, design.md, analysis.md, report.md',
            '',
            `**Location**: \`docs/archive/YYYY-MM/${feature}/\``,
            '',
            '**Tip**: Use `--summary` to preserve metrics'
          ].join('\n')
        },
        {
          label: 'Further Improvement',
          description: 'Apply additional improvements to current feature',
          preview: [
            '## Additional Improvement',
            '',
            `**Current Match Rate**: ${matchRate}%`,
            `**Iterations completed**: ${iterCount}`,
            '',
            `**Command**: \`/pdca iterate ${feature}\``
          ].join('\n')
        },
        {
          label: 'Next Feature',
          description: 'Start new feature PDCA cycle',
          preview: [
            '## New Feature',
            '',
            '**Start commands**:',
            '- `/plan-plus {new-feature}` (recommended)',
            '- `/pdca plan {new-feature}`',
            '',
            `**Current feature**: ${feature} stays at "report" phase`
          ].join('\n')
        }
      ]
    }
  };

  return questionSets[phase] || questionSets['plan'];
}

/**
 * v1.5.1: Detect PDCA phase from TaskCompleted event
 * @param {string} taskSubject - Completed task's subject
 * @returns {{ phase: string, feature: string } | null}
 */
function detectPdcaFromTaskSubject(taskSubject) {
  if (!taskSubject) return null;

  const patterns = {
    pm:     /\[PM\]\s+(.+)/,
    plan:   /\[Plan\]\s+(.+)/,
    design: /\[Design\]\s+(.+)/,
    do:     /\[Do\]\s+(.+)/,
    check:  /\[Check\]\s+(.+)/,
    act:    /\[Act(?:-\d+)?\]\s+(.+)/,
    report: /\[Report\]\s+(.+)/,
  };

  for (const [phase, pattern] of Object.entries(patterns)) {
    const match = taskSubject.match(pattern);
    if (match) {
      return { phase, feature: match[1]?.trim() };
    }
  }

  return null;
}

/**
 * v1.5.1: Determine next PDCA action after TaskCompleted
 * @param {string} phase - Completed phase
 * @param {string} feature - feature name
 * @returns {{ nextPhase: string, command: string, autoExecute: boolean } | null}
 */
function getNextPdcaActionAfterCompletion(phase, feature) {
  if (!phase || !feature) return null;

  const { getConfig } = getCore();
  const { getPdcaStatusFull } = getStatus();

  const pdcaStatus = getPdcaStatusFull();
  const featureData = pdcaStatus?.features?.[feature];
  const matchRate = featureData?.matchRate;

  const nextPhaseMap = {
    pm: { nextPhase: 'plan', command: `/pdca plan ${feature}` },
    plan: { nextPhase: 'design', command: `/pdca design ${feature}` },
    design: { nextPhase: 'do', command: `/pdca do ${feature}` },
    do: { nextPhase: 'check', command: `/pdca analyze ${feature}` },
    check: matchRate >= 90
      ? { nextPhase: 'report', command: `/pdca report ${feature}` }
      : { nextPhase: 'act', command: `/pdca iterate ${feature}` },
    act: { nextPhase: 'check', command: `/pdca analyze ${feature}` },
    report: { nextPhase: 'completed', command: `/pdca archive ${feature}` },
  };

  const next = nextPhaseMap[phase];
  if (!next) return null;

  return {
    ...next,
    autoExecute: shouldAutoAdvance(phase)
  };
}

module.exports = {
  getAutomationLevel,
  isFullAutoMode,
  shouldAutoAdvance,
  generateAutoTrigger,
  generateBatchTrigger,
  shouldSuggestBatch,
  shouldAutoStartPdca,
  autoAdvancePdcaPhase,
  getHookContext,
  emitUserPrompt,
  formatAskUserQuestion,
  buildNextActionQuestion,
  detectPdcaFromTaskSubject,
  getNextPdcaActionAfterCompletion,
};
