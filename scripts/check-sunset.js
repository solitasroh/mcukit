#!/usr/bin/env node
/**
 * check-sunset.js
 *
 * Cycle 2 FR-15 (user decision-2 A) — Sunset alert for transitional
 * NEVER_GATE items in policies/never-gate.json.
 *
 * Behavior:
 *   - sunset_cycle - current_cycle > WARN_BEFORE: silent (item is healthy)
 *   - sunset_cycle - current_cycle <= WARN_BEFORE: print WARN line
 *   - sunset_cycle <= current_cycle: print FAIL line, exit 1
 *
 * Stop hook integration: hooks/hooks.json registers this script. Failure
 * surfaces in session-end output. Stop hook expected to non-block.
 *
 * Cycle 4 (commit cc8bb7f) promoted `network_egress` → permanent and removed
 * `regression_retention` (CR4-1 reject cascade). Cycle 5 has no transitional
 * items — warnings empty in steady state.
 *
 * Current cycle is read from `policies/decisions/cycle*-matrix.json`
 * (highest numbered matrix file).
 *
 * Exit codes (PR #6 H4):
 *   0 — no sunset issues, or `RKIT_SUNSET_BOOTSTRAP=1` with missing inputs
 *   1 — sunset_cycle reached (transitional item past its deadline)
 *   2 — required policies missing without bootstrap flag
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const WARN_BEFORE = 1; // warn when sunset_cycle - current_cycle <= 1

function getCurrentCycle() {
  const decisionsDir = path.join(ROOT, 'policies/decisions');
  if (!fs.existsSync(decisionsDir)) return null;
  const files = fs.readdirSync(decisionsDir).filter((f) => /^cycle\d+(\.\d+)?-matrix\.json$/.test(f));
  if (files.length === 0) return null;
  // pick highest cycle number
  const cycles = files
    .map((f) => {
      const m = f.match(/^cycle(\d+(?:\.\d+)?)-matrix\.json$/);
      return m ? parseFloat(m[1]) : null;
    })
    .filter(Boolean);
  return Math.max(...cycles);
}

function parseCycleString(s) {
  // "cycle-4" -> 4, "cycle-1.5" -> 1.5
  if (typeof s !== 'string') return null;
  const m = s.match(/^cycle-(\d+(?:\.\d+)?)$/);
  return m ? parseFloat(m[1]) : null;
}

function main() {
  // PR #6 H4: distinguish bootstrap (no policies yet — exit 0) from broken
  // state (policies removed/reverted — exit 2). Set RKIT_SUNSET_BOOTSTRAP=1
  // to accept missing inputs during initial repo setup.
  const allowBootstrap = process.env.RKIT_SUNSET_BOOTSTRAP === '1';
  const ngPath = path.join(ROOT, 'policies/never-gate.json');
  if (!fs.existsSync(ngPath)) {
    if (allowBootstrap) {
      console.error('[check-sunset] policies/never-gate.json missing — bootstrap mode, skip');
      process.exit(0);
    }
    console.error('[check-sunset] FAIL: policies/never-gate.json missing. ' +
      'If this is a fresh repo, set RKIT_SUNSET_BOOTSTRAP=1.');
    process.exit(2);
  }
  const ng = JSON.parse(fs.readFileSync(ngPath, 'utf8'));
  const currentCycle = getCurrentCycle();
  if (currentCycle == null) {
    if (allowBootstrap) {
      console.error('[check-sunset] cannot detect current cycle — bootstrap mode, skip');
      process.exit(0);
    }
    console.error('[check-sunset] FAIL: no policies/decisions/cycle*-matrix.json found. ' +
      'If this is a fresh repo, set RKIT_SUNSET_BOOTSTRAP=1.');
    process.exit(2);
  }

  const warnings = [];
  const failures = [];

  for (const item of ng.items || []) {
    // permanent items (including those promoted from transitional) are skipped
    if (item.scope === 'permanent') continue;
    if (item.scope !== 'transitional' || !item.sunset) continue;
    const sunsetCycle = parseCycleString(item.sunset);
    if (sunsetCycle == null) {
      warnings.push(`[check-sunset] ${item.id}: invalid sunset format "${item.sunset}"`);
      continue;
    }
    const remaining = sunsetCycle - currentCycle;
    if (remaining <= 0) {
      failures.push(`[FAIL] never-gate "${item.id}" sunset reached at ${item.sunset} (current cycle ${currentCycle}). Remove or extend.`);
    } else if (remaining <= WARN_BEFORE) {
      warnings.push(`[WARN] never-gate "${item.id}" sunset in ${remaining} cycle(s) at ${item.sunset}. Reevaluate retention.`);
    }
  }

  for (const w of warnings) console.warn(w);
  for (const f of failures) console.error(f);

  if (failures.length > 0) {
    process.exit(1);
  }
  if (warnings.length === 0) {
    // silent on healthy state — Stop hook should not spam
  }
  process.exit(0);
}

main();
