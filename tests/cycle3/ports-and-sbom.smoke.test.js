// Cycle 3 PR-4 — Ports + SBOM smoke tests.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);

test('CR-2: cc-payload.port.js is type-only (module.exports === {})', () => {
  const m = require_('../../lib/domain/ports/cc-payload.port.js');
  assert.deepEqual(m, {});
});

test('CR-2: docs-code-index.port.js is type-only (module.exports === {})', () => {
  const m = require_('../../lib/domain/ports/docs-code-index.port.js');
  assert.deepEqual(m, {});
});

test('CR-2: cc-payload.port declares HookInput + CCPayloadPort typedefs', () => {
  const src = fs.readFileSync('lib/domain/ports/cc-payload.port.js', 'utf8');
  assert.match(src, /@typedef.*HookInput/);
  assert.match(src, /@typedef.*CCPayloadPort/);
  assert.match(src, /parseHookInput/);
  assert.match(src, /detectCCVersion/);
  assert.match(src, /getSessionId/);
});

test('CR-2: docs-code-index.port declares InventoryMeasurement typedef', () => {
  const src = fs.readFileSync('lib/domain/ports/docs-code-index.port.js', 'utf8');
  assert.match(src, /@typedef.*InventoryMeasurement/);
  assert.match(src, /@typedef.*DocsCodeIndexPort/);
  assert.match(src, /measure/);
});

test('CR-2: cc-bridge.js declares @implements CCPayloadPort', () => {
  const src = fs.readFileSync('lib/infra/cc-bridge.js', 'utf8');
  assert.match(src, /@implements.*cc-payload\.port.*CCPayloadPort/);
});

test('CR-2: docs-code-scanner.js declares @implements DocsCodeIndexPort', () => {
  const src = fs.readFileSync('lib/infra/docs-code-scanner.js', 'utf8');
  assert.match(src, /@implements.*docs-code-index\.port.*DocsCodeIndexPort/);
});

test('CR-5: scripts/gen-sbom.mjs exists', () => {
  assert.ok(fs.existsSync('scripts/gen-sbom.mjs'));
});

test('CR-5: gen-sbom.mjs uses npm ci --ignore-scripts + --prefer-offline', () => {
  const src = fs.readFileSync('scripts/gen-sbom.mjs', 'utf8');
  assert.match(src, /npm ci --ignore-scripts --prefer-offline/);
});

test('CR-5: gen-sbom.mjs CI-only signatures (egress=deny preserved)', () => {
  const src = fs.readFileSync('scripts/gen-sbom.mjs', 'utf8');
  assert.match(src, /process\.env\.CI/);
  assert.match(src, /npm audit signatures/);
});

test('CR-5: gen-sbom.mjs no http/https/undici imports (egress check)', () => {
  const src = fs.readFileSync('scripts/gen-sbom.mjs', 'utf8');
  assert.ok(!/from\s+['"]https?['"]/.test(src), 'must not import http/https');
  assert.ok(!/require\(['"]https?['"]\)/.test(src), 'must not require http/https');
  assert.ok(!/undici/.test(src), 'must not use undici');
});

test('CR-5: .github/workflows/sbom.yml exists with required triggers', () => {
  const src = fs.readFileSync('.github/workflows/sbom.yml', 'utf8');
  assert.match(src, /pull_request:/);
  assert.match(src, /push:/);
  assert.match(src, /schedule:/);
  assert.match(src, /upload-artifact/);
});

test('CR-5: package.json scripts.sbom registered', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkg.scripts, 'scripts field required');
  assert.equal(pkg.scripts.sbom, 'node scripts/gen-sbom.mjs');
});

test('CR-5: sbom/bom.json generated (CycloneDX format)', () => {
  assert.ok(fs.existsSync('sbom/bom.json'));
  const bom = JSON.parse(fs.readFileSync('sbom/bom.json', 'utf8'));
  assert.equal(bom.bomFormat, 'CycloneDX');
  assert.ok(bom.specVersion);
  assert.ok(bom.metadata?.component?.name);
});

test('CR-5: .gitattributes marks bom.json linguist-generated', () => {
  const src = fs.readFileSync('.gitattributes', 'utf8');
  assert.match(src, /sbom\/bom\.json\s+linguist-generated=true/);
});
