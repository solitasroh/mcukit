#!/usr/bin/env node
/**
 * cto-stop.js - CTO Lead Agent Stop Handler (v1.5.1)
 *
 * CTO agent session cleanup:
 * 1. Save current team state
 * 2. Record incomplete tasks
 * 3. Add CTO session end to PDCA history
 */

const { debugLog } = require('../lib/core/debug');
const { outputAllow } = require('../lib/core/hook-io');
const { getPdcaStatusFull, addPdcaHistory } = require('../lib/pdca/status');

function run(context) {
  debugLog('CTOStop', 'CTO session cleanup started');

  const pdcaStatus = getPdcaStatusFull();
  const feature = pdcaStatus?.primaryFeature;

  if (feature) {
    let teamModule = null;
    try {
      teamModule = require('../lib/team');
    } catch (e) {
      // Graceful degradation
    }

    if (teamModule) {
      const featureData = pdcaStatus.features?.[feature];
      const progress = teamModule.getTeamProgress(feature, featureData?.phase);
      addPdcaHistory({
        action: 'cto_session_ended',
        feature,
        phase: featureData?.phase,
        teamProgress: progress,
      });

      debugLog('CTOStop', 'Team state saved', {
        feature,
        phase: featureData?.phase,
        progress,
      });
    }

    // State writer: agent state cleanup (v1.5.3 Team Visibility)
    try {
      if (teamModule.cleanupAgentState) {
        teamModule.cleanupAgentState();
      }
    } catch (e) {
      debugLog('CTOStop', 'Agent state cleanup failed (non-fatal)', { error: e.message });
    }
  }

  // v2.0.0: Audit logging
  try {
    const audit = require('../lib/audit/audit-logger');
    audit.writeAuditLog({
      actor: 'agent', actorId: 'cto-lead',
      action: 'session_ended',
      category: 'lifecycle',
      target: feature || 'unknown', targetType: 'feature',
      details: { phase: pdcaStatus.features?.[feature]?.phase },
      result: 'success'
    });
  } catch (_) {}

  outputAllow('CTO session ended. Team state saved for next session.', 'CTOStop');
  debugLog('CTOStop', 'CTO session cleanup completed');
}

module.exports = { run };
