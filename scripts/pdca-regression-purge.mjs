#!/usr/bin/env node
/**
 * pdca-regression-purge.mjs
 *
 * @deprecated cycle-4 CR4-1 permanent_reject (2026-05-13). lib/cc-regression/
 * never adopted in rkit. This tool is preserved as a standalone jsonl purge
 * utility — reusable for other .rkit/state/*.jsonl domains if introduced later.
 * No manifest registration, no active call sites (verified via Grep).
 *
 * Cycle 2 FR-08 (D-8 GDPR) — Purge cc-regression entries.
 *
 * Council code-analyzer MEDIUM-3 + infra HIGH-2 reflected:
 *   - .lock file (rename atomic, race protection vs concurrent append)
 *   - process.stdin.isTTY check (CI non-TTY auto-abort for --all)
 *   - atomic write (tmpfile + rename) for purge result
 *   - dry-run mode
 *
 * Usage:
 *   node scripts/pdca-regression-purge.mjs --older-than=90d  (default retention)
 *   node scripts/pdca-regression-purge.mjs --all             (delete everything, requires TTY confirmation)
 *   node scripts/pdca-regression-purge.mjs --dry-run         (count only, no delete)
 *
 * Exit codes:
 *   0 — success or nothing to purge
 *   1 — lock acquisition failed (another purge running)
 *   2 — non-TTY environment refused --all (safety)
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const REGRESSION_LOG = path.join(ROOT, '.rkit/state/cc-regression.jsonl');
const LOCK_PATH = REGRESSION_LOG + '.lock';
const DEFAULT_RETENTION_DAYS = 90;

function acquireLock() {
  try {
    const fd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeSync(fd, String(process.pid) + ':' + Date.now());
    fs.closeSync(fd);
    return true;
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  }
}

function releaseLock() {
  try { fs.unlinkSync(LOCK_PATH); } catch {}
}

async function confirmDestructive(count) {
  if (!process.stdin.isTTY) {
    console.error('[abort] non-TTY environment refused destructive --all (safety check, council infra HIGH-2)');
    process.exit(2);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question(`Delete ${count} cc-regression entries? Cannot be undone. (yes/N): `);
  rl.close();
  return ans.trim().toLowerCase() === 'yes';
}

function parseArgs() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const dryRun = args.includes('--dry-run');
  const olderThanMatch = args.find((a) => a.startsWith('--older-than='));
  let olderThanDays = DEFAULT_RETENTION_DAYS;
  if (olderThanMatch) {
    const m = olderThanMatch.match(/^--older-than=(\d+)d?$/);
    if (m) olderThanDays = parseInt(m[1], 10);
  }
  return { all, dryRun, olderThanDays };
}

async function main() {
  const { all, dryRun, olderThanDays } = parseArgs();

  if (!fs.existsSync(REGRESSION_LOG)) {
    console.log('No cc-regression log found, nothing to purge.');
    return;
  }

  if (!acquireLock()) {
    console.error('[abort] another purge in progress (lock file exists). Retry later or delete .lock manually.');
    process.exit(1);
  }

  try {
    const cutoff = Date.now() - olderThanDays * 86400 * 1000;
    const lines = fs.readFileSync(REGRESSION_LOG, 'utf8').split('\n').filter(Boolean);
    const keep = all
      ? []
      : lines.filter((l) => {
          try {
            return new Date(JSON.parse(l).timestamp).getTime() >= cutoff;
          } catch {
            return true; // malformed line preserved
          }
        });
    const deleteCount = lines.length - keep.length;

    if (deleteCount === 0) {
      console.log('Nothing to purge.');
      return;
    }

    if (dryRun) {
      console.log(`[dry-run] would delete ${deleteCount} entries (kept ${keep.length}).`);
      return;
    }

    if (all && !(await confirmDestructive(deleteCount))) {
      console.log('Aborted.');
      return;
    }

    const tmp = REGRESSION_LOG + '.tmp.' + process.pid + '.' + Date.now();
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeSync(fd, keep.length > 0 ? keep.join('\n') + '\n' : '');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, REGRESSION_LOG);

    console.log(`Purged ${deleteCount} entries. Kept ${keep.length}.`);
  } finally {
    releaseLock();
  }
}

main().catch((err) => {
  releaseLock();
  console.error(err);
  process.exit(1);
});
