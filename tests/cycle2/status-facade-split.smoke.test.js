// Cycle 2 G adopt smoke test — status.js facade split.
// Verifies 27 exports preserved + 5 submodules independently loadable.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);

const EXPECTED_FACADE_EXPORTS = [
  'createInitialStatusV2', 'migrateStatusToV2', 'migrateStatusV2toV3',
  'getPdcaStatusPath', 'initPdcaStatusIfNotExists', 'getPdcaStatusFull',
  'loadPdcaStatus', 'savePdcaStatus',
  'getFeatureStatus', 'updatePdcaStatus', 'addPdcaHistory', 'completePdcaFeature',
  'setActiveFeature', 'addActiveFeature', 'removeActiveFeature',
  'deleteFeatureFromStatus', 'enforceFeatureLimit', 'getArchivedFeatures',
  'cleanupArchivedFeatures', 'archiveFeatureToSummary',
  'getActiveFeatures', 'switchFeatureContext', 'extractFeatureFromContext',
  'readMemory', 'writeMemory', 'readBkitMemory', 'writeBkitMemory',
];

test('facade: all 27 expected functions exported', () => {
  const s = require_('../../lib/pdca/status');
  for (const k of EXPECTED_FACADE_EXPORTS) {
    assert.equal(typeof s[k], 'function', `${k} should be a function`);
  }
});

test('schema submodule loads standalone', () => {
  const m = require_('../../lib/pdca/status/schema');
  assert.equal(typeof m.createInitialStatusV2, 'function');
  assert.equal(typeof m.migrateStatusToV2, 'function');
  assert.equal(typeof m.migrateStatusV2toV3, 'function');
  const initial = m.createInitialStatusV2();
  assert.equal(initial.version, '2.0');
  assert.ok(Array.isArray(initial.activeFeatures));
});

test('store submodule loads standalone', () => {
  const m = require_('../../lib/pdca/status/store');
  assert.equal(typeof m.getPdcaStatusPath, 'function');
  assert.equal(typeof m.getPdcaStatusFull, 'function');
  assert.equal(typeof m.savePdcaStatus, 'function');
});

test('feature-lifecycle submodule loads standalone', () => {
  const m = require_('../../lib/pdca/status/feature-lifecycle');
  const fns = [
    'getFeatureStatus', 'updatePdcaStatus', 'addPdcaHistory', 'completePdcaFeature',
    'setActiveFeature', 'addActiveFeature', 'removeActiveFeature',
    'deleteFeatureFromStatus', 'enforceFeatureLimit', 'getArchivedFeatures',
    'cleanupArchivedFeatures', 'archiveFeatureToSummary',
    'getActiveFeatures', 'switchFeatureContext',
  ];
  for (const fn of fns) assert.equal(typeof m[fn], 'function', `${fn} missing`);
});

test('context submodule loads standalone', () => {
  const m = require_('../../lib/pdca/status/context');
  assert.equal(typeof m.extractFeatureFromContext, 'function');
});

test('memory-io submodule loads standalone', () => {
  const m = require_('../../lib/pdca/status/memory-io');
  assert.equal(typeof m.readMemory, 'function');
  assert.equal(typeof m.writeMemory, 'function');
});

test('readBkitMemory alias === readMemory', () => {
  const s = require_('../../lib/pdca/status');
  assert.equal(s.readBkitMemory, s.readMemory);
  assert.equal(s.writeBkitMemory, s.writeMemory);
});

test('schema/createInitialStatusV2 returns valid v2 shape', () => {
  const s = require_('../../lib/pdca/status');
  const initial = s.createInitialStatusV2();
  assert.equal(initial.version, '2.0');
  assert.ok(initial.lastUpdated);
  assert.equal(typeof initial.features, 'object');
  assert.ok(Array.isArray(initial.history));
});

test('schema/migrateStatusV2toV3 adds stateMachine/automation/team', () => {
  const s = require_('../../lib/pdca/status');
  const v2 = s.createInitialStatusV2();
  const v3 = s.migrateStatusV2toV3(v2);
  assert.equal(v3.version, '3.0');
  assert.ok(v3.stateMachine);
  assert.ok(v3.automation);
  assert.ok(v3.team);
});

test('SQ-004: facade file size < 100 lines', () => {
  const fs = require_('node:fs');
  const facade = fs.readFileSync('lib/pdca/status.js', 'utf8');
  const lines = facade.split('\n').length;
  assert.ok(lines < 100, `facade should be < 100 lines, got ${lines}`);
});

test('SQ-004: each submodule < 400 lines', () => {
  const fs = require_('node:fs');
  const files = [
    'lib/pdca/status/schema.js',
    'lib/pdca/status/store.js',
    'lib/pdca/status/feature-lifecycle.js',
    'lib/pdca/status/context.js',
    'lib/pdca/status/memory-io.js',
  ];
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n').length;
    assert.ok(lines < 400, `${f} should be < 400 lines, got ${lines}`);
  }
});
