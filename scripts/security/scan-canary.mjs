#!/usr/bin/env node
/**
 * scan-canary.mjs
 *
 * Cycle 4 CR4-7 — Canary regex scanner for secret leak detection.
 *
 * Reads patterns from `scripts/security/canary-patterns.json` (SoT) and
 * scans repository files (excluding test/mock/fixtures/docs-examples) for
 * matches. Reports HIGH severity findings with file:line.
 *
 * Offline only — no network egress (egress=deny policy preserved).
 *
 * Usage:
 *   node scripts/security/scan-canary.mjs           # scan repo, exit 1 on match
 *   node scripts/security/scan-canary.mjs --quiet   # only failures printed
 *   node scripts/security/scan-canary.mjs --dry-run # report but exit 0 (CI bootstrap)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const argv = process.argv.slice(2);
const quiet = argv.includes('--quiet');
const dryRun = argv.includes('--dry-run');

function loadConfig() {
  const cfgPath = path.join(ROOT, 'scripts/security/canary-patterns.json');
  return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
}

function globToRegex(glob) {
  // Minimal glob → regex (supports **, *, ?).
  let re = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__GLOBSTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__GLOBSTAR__/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp('^' + re + '$');
}

function shouldExclude(relPath, exclusionGlobs) {
  for (const g of exclusionGlobs) {
    if (globToRegex(g).test(relPath)) return true;
  }
  return false;
}

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'sbom') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile()) {
      const rel = path.relative(ROOT, full).replace(/\\/g, '/');
      if (/\.(png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|pdf|zip|tar|gz|exe|dll|so)$/i.test(e.name)) continue;
      out.push(rel);
    }
  }
  return out;
}

function scan() {
  const cfg = loadConfig();
  const patterns = cfg.patterns.map((p) => ({ ...p, _re: new RegExp(p.regex) }));
  const files = walk(ROOT);
  const findings = [];
  let scanned = 0;
  for (const rel of files) {
    if (shouldExclude(rel, cfg.exclusion_globs || [])) continue;
    let content;
    try { content = fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
    catch { continue; }
    scanned++;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const p of patterns) {
        if (p._re.test(line)) {
          findings.push({
            file: rel,
            line: i + 1,
            pattern: p.id,
            service: p.service,
            severity: p.severity,
            snippet: line.length > 100 ? line.slice(0, 97) + '...' : line,
          });
        }
      }
    }
  }
  return { scanned, findings };
}

const { scanned, findings } = scan();

if (findings.length === 0) {
  if (!quiet) console.log(`✅ canary scan: 0 leaks in ${scanned} files`);
  process.exit(0);
}

console.error(`❌ canary scan: ${findings.length} potential leak(s) in ${scanned} files`);
for (const f of findings) {
  console.error(`   ${f.file}:${f.line} [${f.pattern} ${f.service} ${f.severity}]`);
  if (!quiet) console.error(`     ${f.snippet}`);
}

if (dryRun) {
  console.error('   (dry-run mode — exit 0)');
  process.exit(0);
}
process.exit(1);
