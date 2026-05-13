// Cycle 2 F partial_adopt smoke tests.
// docs-code-scanner.js + cc-bridge.js adopted; telemetry.js deferred.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const scanner = require_('../../lib/infra/docs-code-scanner.js');
const bridge = require_('../../lib/infra/cc-bridge.js');

test('docs-code-scanner: measure() returns inventory shape', async () => {
  const m = await scanner.measure();
  for (const k of ['skills', 'agents', 'hookEvents', 'hookBlocks', 'mcpServers', 'mcpTools', 'libModules', 'scripts']) {
    assert.equal(typeof m[k], 'number', `${k} should be number`);
    assert.ok(m[k] >= 0, `${k} should be non-negative`);
  }
});

test('docs-code-scanner: countSkills > 0 (rkit has skills/)', () => {
  assert.ok(scanner.countSkills() > 0);
});

test('docs-code-scanner: countAgents > 0 (rkit has agents/)', () => {
  assert.ok(scanner.countAgents() > 0);
});

test('docs-code-scanner: countMCPTools uses rkit_ prefix (not bkit_)', () => {
  // rkit servers/ contain rkit_*-named tools. bkit_ prefix would return 0.
  const count = scanner.countMCPTools();
  assert.ok(count > 0, `expected rkit_ prefix to match >= 1 tool, got ${count}`);
});

test('docs-code-scanner: scanVersions canonical from package.json', async () => {
  const v = await scanner.scanVersions();
  assert.ok('canonical' in v);
  assert.ok('packageJson' in v, 'canonical SoT must be package.json:version');
  assert.ok(!('bkitConfig' in v), 'must NOT expose bkitConfig field');
  assert.ok(!('rkitConfig' in v), 'rkit.config.json is subsystem version, not canonical');
  assert.ok(Array.isArray(v.mismatches));
});

test('docs-code-scanner: canonical === package.json version (matches session-start.js)', async () => {
  const v = await scanner.scanVersions();
  const pkg = JSON.parse(require_('node:fs').readFileSync('package.json', 'utf8'));
  assert.equal(v.canonical, pkg.version, 'canonical must match package.json — same source hooks/session-start.js uses');
});

test('cc-bridge: parseHookInput handles null/empty', () => {
  assert.equal(bridge.parseHookInput(null), null);
  assert.equal(bridge.parseHookInput(undefined), null);
  assert.equal(bridge.parseHookInput(''), null);
  assert.equal(bridge.parseHookInput('   '), null);
});

test('cc-bridge: parseHookInput handles malformed JSON', () => {
  assert.equal(bridge.parseHookInput('not json'), null);
  assert.equal(bridge.parseHookInput('[1,2,3]'), null);
});

test('cc-bridge: parseHookInput parses valid object', () => {
  const r = bridge.parseHookInput('{"session_id":"abc","tool_name":"Read"}');
  assert.equal(r.session_id, 'abc');
  assert.equal(r.tool_name, 'Read');
});

test('cc-bridge: getSessionId fallback order', () => {
  assert.equal(bridge.getSessionId({ session_id: 'a' }), 'a');
  assert.equal(bridge.getSessionId({ sessionId: 'b' }), 'b');
  delete process.env.CLAUDE_SESSION_ID;
  assert.equal(bridge.getSessionId({}), null);
  assert.equal(bridge.getSessionId(null), null);
});

test('cc-bridge: isBypassMode reads RKIT_CC_REGRESSION_BYPASS (not BKIT_)', () => {
  delete process.env.BKIT_CC_REGRESSION_BYPASS;
  delete process.env.RKIT_CC_REGRESSION_BYPASS;
  assert.equal(bridge.isBypassMode(), false);
  process.env.RKIT_CC_REGRESSION_BYPASS = '1';
  assert.equal(bridge.isBypassMode(), true);
  process.env.RKIT_CC_REGRESSION_BYPASS = 'true';
  assert.equal(bridge.isBypassMode(), true);
  delete process.env.RKIT_CC_REGRESSION_BYPASS;
});

test('cc-bridge: getPermissionFlags defaults false', () => {
  const flags = bridge.getPermissionFlags(null);
  assert.equal(flags.bypassPermissions, false);
  assert.equal(flags.dangerouslyDisableSandbox, false);
});

test('cc-bridge: getPermissionFlags extracts true flags', () => {
  const flags = bridge.getPermissionFlags({ permissions: { bypassPermissions: true, dangerouslyDisableSandbox: true } });
  assert.equal(flags.bypassPermissions, true);
  assert.equal(flags.dangerouslyDisableSandbox, true);
});

test('cc-bridge: getHookEventName extracts field', () => {
  assert.equal(bridge.getHookEventName({ hook_event_name: 'SessionStart' }), 'SessionStart');
  assert.equal(bridge.getHookEventName(null), null);
  assert.equal(bridge.getHookEventName({}), null);
});

test('F defer: telemetry.js NOT adopted (http/https egress violation)', () => {
  const fs = require_('node:fs');
  const exists = fs.existsSync('lib/infra/telemetry.js');
  assert.equal(exists, false, 'telemetry.js must NOT be adopted (cycle 2 F defer)');
});

test('F: no http/https import in adopted lib/infra/ modules', () => {
  const fs = require_('node:fs');
  for (const f of ['lib/infra/docs-code-scanner.js', 'lib/infra/cc-bridge.js']) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/require\(['"]https?['"]\)/.test(src), `${f} must not import http/https`);
    assert.ok(!/from\s+['"]https?['"]/.test(src), `${f} must not import http/https (ESM)`);
  }
});
