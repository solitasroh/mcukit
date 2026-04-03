#!/usr/bin/env node
/**
 * pdca-task-completed.js - TaskCompleted Hook Handler (v1.5.1)
 *
 * Auto-advances to the next PDCA phase when a Task is completed.
 *
 * Flow:
 * 1. Detect PDCA phase from completed Task's subject ([Plan], [Design], etc.)
 * 2. Extract feature name
 * 3. Check shouldAutoAdvance()
 * 4. Output next phase guidance message on auto-advance
 * 5. Update .rkit/state/memory.json
 */

const { readStdinSync, outputAllow } = require('../lib/core/io');
const { debugLog } = require('../lib/core/debug');
const { getPdcaStatusFull } = require('../lib/pdca/status');
const { autoAdvancePdcaPhase, shouldAutoAdvance, getAutomationLevel, formatAskUserQuestion, buildNextActionQuestion, detectPdcaFromTaskSubject } = require('../lib/pdca/automation');

function main() {
  debugLog('TaskCompleted', 'Hook started');

  let hookContext = {};
  try {
    const input = readStdinSync();
    hookContext = typeof input === 'string' ? JSON.parse(input) : input;
  } catch (e) {
    debugLog('TaskCompleted', 'Failed to parse context', { error: e.message });
    outputAllow('TaskCompleted processed.', 'TaskCompleted');
    return;
  }

  // Detect PDCA phase from task subject
  const taskSubject = hookContext.task_subject
    || hookContext.tool_input?.subject
    || '';

  // v1.5.9: ENH-74 agent_id first-priority extraction
  const agentId = hookContext.agent_id || null;
  const agentType = hookContext.agent_type || null;

  // Use detectPdcaFromTaskSubject instead of inline duplicate patterns
  const detected = detectPdcaFromTaskSubject(taskSubject);
  if (!detected) {
    // not a PDCA task
    outputAllow('Non-PDCA task completed');
    process.exit(0);
  }
  const detectedPhase = detected.phase;
  const featureName = detected.feature;

  debugLog('TaskCompleted', 'PDCA task detected', {
    phase: detectedPhase,
    feature: featureName
  });

  // Check auto-advance
  const automationLevel = getAutomationLevel();
  if (shouldAutoAdvance(detectedPhase)) {
    const pdcaStatus = getPdcaStatusFull();
    const featureData = pdcaStatus?.features?.[featureName];
    const matchRate = featureData?.matchRate;

    const result = autoAdvancePdcaPhase(featureName, detectedPhase, { matchRate });

    if (result) {
      const nextPhase = result.phase;
      const response = {
        systemMessage: `PDCA auto-advance: ${detectedPhase} → ${nextPhase}`,
        // v1.5.9: ENH-75 quality gate - stop teammate when reaching report/completed
        continue: (nextPhase === 'report' || nextPhase === 'completed') ? false : undefined,
        hookSpecificOutput: {
          hookEventName: "TaskCompleted",
          pdcaPhase: detectedPhase,
          nextPhase: nextPhase,
          feature: featureName,
          autoAdvanced: true,
          agentId,
          agentType,
          additionalContext: `\n## PDCA Auto-Advance\n` +
            `Task [${detectedPhase.toUpperCase()}] ${featureName} completed.\n` +
            `Next phase: ${nextPhase}\n` +
            (result.trigger ? `Suggested command: /pdca ${result.trigger.args}\n` : '')
        }
      };

      // Team Mode: generate team assignment for next phase
      let teamModule = null;
      try {
        teamModule = require('../lib/team');
      } catch (e) {
        // Graceful degradation
      }

      if (teamModule && teamModule.isTeamModeAvailable()) {
        const level = pdcaStatus?.features?.[featureName]?.level || 'Dynamic';
        const assignment = teamModule.assignNextTeammateWork(detectedPhase, featureName, level);
        if (assignment) {
          debugLog('TaskCompleted', 'Team assignment generated', {
            nextPhase: assignment.nextPhase,
            teammateCount: assignment.team?.teammates?.length || 0,
            needsRecompose: assignment.needsRecompose,
          });

          response.hookSpecificOutput.teamAssignment = {
            nextPhase: assignment.nextPhase,
            pattern: assignment.team?.pattern,
            teammates: assignment.team?.teammates?.map(t => t.name) || [],
            notice: assignment.notice,
          };
        }
      }

      // State writer: update progress + record message (v1.5.3 Team Visibility)
      try {
        if (teamModule && teamModule.updateProgress) {
          const progress = teamModule.getTeamProgress(featureName, detectedPhase);
          teamModule.updateProgress(progress);

          // Record message on phase transition
          if (response.hookSpecificOutput.autoAdvanced) {
            teamModule.addRecentMessage({
              from: 'system',
              to: 'all',
              content: `Phase ${detectedPhase} → ${response.hookSpecificOutput.nextPhase} (auto-advanced)`,
            });
          }
        }
      } catch (e) {
        debugLog('TaskCompleted', 'State write failed (non-fatal)', { error: e.message });
      }

      console.log(JSON.stringify(response));
      process.exit(0);
    }
  }

  // v1.5.9: Executive Summary + Next Action for manual mode (plan/report completion)
  if (detectedPhase === 'plan' || detectedPhase === 'report') {
    const featureStatus = getPdcaStatusFull()?.features?.[featureName] || {};
    const questionPayload = buildNextActionQuestion(detectedPhase, featureName, {
      matchRate: featureStatus.matchRate || 0,
      iterCount: featureStatus.iterationCount || 0
    });
    const formatted = formatAskUserQuestion(questionPayload);

    // v1.5.9: P2-FR-07 Executive Summary + AskUserQuestion sequential output
    const { generateExecutiveSummary, formatExecutiveSummary } = require('../lib/pdca/executive-summary');
    const summary = generateExecutiveSummary(featureName, detectedPhase);
    const summaryText = formatExecutiveSummary(summary, 'full');

    const manualResponse = {
      systemMessage: [
        `## PDCA ${detectedPhase.toUpperCase()} Completed`,
        '',
        `**Feature**: ${featureName}`,
        '',
        summaryText,
        '',
        `---`,
        '',
        `**Please select next step.**`
      ].join('\n'),
      userPrompt: JSON.stringify(formatted)
    };
    console.log(JSON.stringify(manualResponse));
    process.exit(0);
  }

  outputAllow(`PDCA Task [${detectedPhase}] ${featureName} completed.`, 'TaskCompleted');
}

main();
