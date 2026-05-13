#!/usr/bin/env node
/**
 * gen-sbom.mjs
 *
 * Cycle 3 CR-5 — CycloneDX SBOM 자동 생성.
 *
 * Local mode: offline only (npm ci --ignore-scripts --prefer-offline). No
 * external egress. signatures verification skipped (allowed by policies/
 * network-allowlist.json without registry.npmjs.org allowlist).
 *
 * CI mode (process.env.CI === 'true'): runs `npm audit signatures` after
 * SBOM generation. CI environment is outside policies/network-allowlist
 * scope — sunset cycle-4 of network_egress NEVER_GATE unaffected.
 *
 * Output:
 *   sbom/bom.json (CycloneDX JSON, --omit dev)
 *
 * Usage:
 *   npm run sbom                  # local offline
 *   CI=true npm run sbom          # local + signatures (CI use)
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'sbom');
const OUT_FILE = path.join(OUT_DIR, 'bom.json');

function log(msg) {
  process.stderr.write(`[gen-sbom] ${msg}\n`);
}

function main() {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  log('Installing deps (npm ci --ignore-scripts --prefer-offline)');
  try {
    execSync('npm ci --ignore-scripts --prefer-offline', {
      cwd: ROOT,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
  } catch (e) {
    log(`npm ci failed (continuing with existing node_modules): ${e.message}`);
  }

  log('Generating CycloneDX JSON');
  let bom;
  try {
    bom = execSync(
      'npx --no-install @cyclonedx/cyclonedx-npm --output-format JSON --omit dev',
      { cwd: ROOT, encoding: 'utf8' }
    );
  } catch (e) {
    log(`cyclonedx-npm failed — using fallback minimal SBOM: ${e.message}`);
    const pkg = JSON.parse(execSync('npm pkg get name version', { cwd: ROOT, encoding: 'utf8' }));
    bom = JSON.stringify(
      {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        version: 1,
        metadata: {
          timestamp: new Date().toISOString(),
          component: { type: 'application', name: pkg.name || 'rkit', version: pkg.version || 'unknown' },
          properties: [
            // PR #6 H5: machine-readable warnings so supply-chain consumers
            // can distinguish a zero-component product from a degraded scan.
            { name: 'rkit:sbom:degraded', value: 'true' },
            { name: 'rkit:sbom:reason', value: 'cyclonedx-npm unavailable — using fallback minimal SBOM' },
          ],
        },
        components: [],
        note: 'fallback SBOM — install @cyclonedx/cyclonedx-npm for full inventory',
      },
      null,
      2
    );
  }

  writeFileSync(OUT_FILE, bom);

  let componentCount = 0;
  try {
    componentCount = JSON.parse(bom).components?.length ?? 0;
  } catch { /* parse fail tolerated */ }
  log(`Wrote ${path.relative(ROOT, OUT_FILE)} (${componentCount} components)`);

  if (process.env.CI === 'true') {
    log('CI mode — running npm audit signatures');
    try {
      execSync('npm audit signatures', { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
      log('signatures OK');
    } catch (e) {
      log(`signatures check FAILED — exit 0 (continue-on-error): ${e.message}`);
      // Don't exit 1 — CI configures continue-on-error per Design DR-3 W-2 mitigation
    }
  } else {
    log('local mode — signatures skipped (egress=deny policy)');
  }
}

main();
