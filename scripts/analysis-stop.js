#!/usr/bin/env node
/**
 * analysis-stop.js - Guide report generation after gap analysis
 *
 * Purpose: Provide guidance after gap analysis completion
 * Hook: Stop for phase-8-review skill (gap analysis component)
 *
 * Converted from: scripts/analysis-stop.sh
 */

const { outputAllow } = require('../lib/core/hook-io');

// Output guidance for next steps after gap analysis
const message = `📊 Gap Analysis completed.

Next steps:
1. Save report to docs/03-analysis/
2. If match rate < 70%: Run /pdca-iterate for auto-fix
3. If match rate >= 90%: Proceed to next phase
4. Update design doc if implementation differs intentionally`;

// v2.0.0: Metrics collection
try {
  const mc = require('../lib/quality/metrics-collector');
  const { extractFeatureFromContext, getPdcaStatusFull } = require('../lib/pdca/status');
  const currentStatus = getPdcaStatusFull();
  const feature = extractFeatureFromContext({ currentStatus });
  const matchRate = currentStatus.features?.[feature]?.matchRate || 0;
  mc.collectMetric('M1', feature || 'unknown', matchRate, 'analysis');
} catch (_) {}

// v1.4.0: Stop hook에 맞는 스키마 사용
outputAllow(message, 'Stop');
