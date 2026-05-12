#!/usr/bin/env node
/**
 * verify-status-schema.js
 *
 * Cycle 2 FR-12 — Validates that all archived features in
 * docs/archive/**\/_INDEX.md remain readable from .rkit/state/pdca-status.json.
 *
 * Council code-analyzer HIGH-2 reflected:
 *   - No hardcoded ARCHIVED_FEATURES list. Dynamically parses _INDEX.md tables.
 *
 * Used by Cycle 2 candidate G (lib/pdca/status.js split) as the FR-12
 * compatibility matrix gate. Run before and after any status schema change.
 *
 * Usage:
 *   node scripts/verify-status-schema.js --before  (capture baseline)
 *   node scripts/verify-status-schema.js --after   (compare against baseline)
 *   node scripts/verify-status-schema.js           (one-shot check)
 *
 * Exit codes:
 *   0 — all archived features readable + schema compatible
 *   1 — at least one archived feature unreadable or schema regression
 *   2 — usage error
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATUS_PATH = path.join(ROOT, '.rkit/state/pdca-status.json');
const ARCHIVE_ROOT = path.join(ROOT, 'docs/archive');
const BASELINE_PATH = path.join(ROOT, '.rkit/state/.verify-status-schema-baseline.json');

function loadArchivedFeatures() {
  const features = [];
  if (!fs.existsSync(ARCHIVE_ROOT)) return features;
  // walk monthly _INDEX.md files
  for (const month of fs.readdirSync(ARCHIVE_ROOT, { withFileTypes: true })) {
    if (!month.isDirectory()) continue;
    const indexPath = path.join(ARCHIVE_ROOT, month.name, '_INDEX.md');
    if (!fs.existsSync(indexPath)) continue;
    const txt = fs.readFileSync(indexPath, 'utf8');
    // markdown table rows: | feature-name | matchRate | iterations | date |
    const lines = txt.split('\n');
    for (const line of lines) {
      const m = line.match(/^\|\s*([a-z0-9][a-z0-9-]*)\s*\|/);
      if (!m) continue;
      const id = m[1];
      if (id === 'feature') continue; // header row
      features.push({ id, month: month.name });
    }
  }
  return features;
}

function loadStatus() {
  if (!fs.existsSync(STATUS_PATH)) {
    return { features: {} };
  }
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function check() {
  const status = loadStatus();
  const archived = loadArchivedFeatures();
  const errors = [];
  const summary = { totalArchived: archived.length, readable: 0, missing: 0, malformed: 0 };

  for (const { id, month } of archived) {
    const feature = status.features?.[id];
    if (!feature) {
      errors.push(`[missing] ${month}/${id}: not in pdca-status.json features[] — may be cleaned via /pdca cleanup (acceptable post-summary)`);
      summary.missing++;
      continue;
    }
    if (feature.phase !== 'archived') {
      errors.push(`[malformed] ${id}: phase="${feature.phase}", expected "archived"`);
      summary.malformed++;
      continue;
    }
    if (feature.archivedTo == null) {
      errors.push(`[malformed] ${id}: archivedTo field missing`);
      summary.malformed++;
      continue;
    }
    // verify archived directory actually exists
    const archivePath = path.join(ROOT, feature.archivedTo);
    if (!fs.existsSync(archivePath)) {
      errors.push(`[malformed] ${id}: archivedTo path "${feature.archivedTo}" does not exist`);
      summary.malformed++;
      continue;
    }
    summary.readable++;
  }

  return { summary, errors };
}

const mode = process.argv[2] || '--check';

if (mode === '--before') {
  const result = check();
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(result.summary, null, 2));
  console.log(`[before] baseline saved: ${result.summary.readable}/${result.summary.totalArchived} readable`);
  if (result.errors.length > 0) {
    console.warn('[before] existing issues:');
    for (const e of result.errors) console.warn('  ' + e);
  }
  process.exit(0);
} else if (mode === '--after') {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error('[after] baseline missing. Run --before first.');
    process.exit(2);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const result = check();
  if (result.summary.readable < baseline.readable) {
    console.error(`[FAIL] readable count regressed: ${baseline.readable} -> ${result.summary.readable}`);
    for (const e of result.errors) console.error('  ' + e);
    process.exit(1);
  }
  console.log(`[after] readable ${baseline.readable} -> ${result.summary.readable} (no regression)`);
  process.exit(0);
} else {
  // one-shot
  const result = check();
  console.log(`archived features: ${result.summary.totalArchived} total, ${result.summary.readable} readable, ${result.summary.missing} cleanup-removed, ${result.summary.malformed} malformed`);
  if (result.summary.malformed > 0) {
    for (const e of result.errors.filter((x) => x.startsWith('[malformed]'))) console.error(e);
    process.exit(1);
  }
  process.exit(0);
}
