#!/usr/bin/env node
/**
 * qa-stop.js - Guide next steps after QA session completion
 *
 * Purpose: Provide guidance after Zero Script QA session
 * Hook: Stop for zero-script-qa skill
 *
 * Converted from: scripts/qa-stop.sh
 */

const { outputAllow } = require('../lib/core/hook-io');

// Output guidance for next steps after QA session
const message = `QA Session completed.

Next steps:
1. Review logs for any missed issues
2. Document findings in docs/03-analysis/
3. Run /pdca-iterate if issues found need fixing`;

// v2.0.0: M5/M6 metrics collection
try {
  const mc = require('../lib/quality/metrics-collector');
  const { extractFeatureFromContext, getPdcaStatusFull } = require('../lib/pdca/status');
  const currentStatus = getPdcaStatusFull();
  const feature = extractFeatureFromContext({ currentStatus });
  mc.collectMetric('M5', feature || 'unknown', 1, 'qa-stop');
  mc.collectMetric('M6', feature || 'unknown', 1, 'qa-stop');
} catch (_) {}

// v1.4.0: Stop hook에 맞는 스키마 사용
outputAllow(message, 'Stop');
