// Cycle 2 P0 candidate B partial_adopt smoke tests.
// Type-only ports — module.exports === {} expected.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);

test('state-store.port: type-only module', () => {
  const m = require_('../../lib/domain/ports/state-store.port.js');
  assert.deepEqual(m, {}, 'type-only port should export empty object');
});

test('audit-sink.port: type-only module', () => {
  const m = require_('../../lib/domain/ports/audit-sink.port.js');
  assert.deepEqual(m, {}, 'type-only port should export empty object');
});

test('ports JSDoc documents required typedefs', () => {
  const fs = require_('node:fs');
  const stateStore = fs.readFileSync('lib/domain/ports/state-store.port.js', 'utf8');
  const auditSink = fs.readFileSync('lib/domain/ports/audit-sink.port.js', 'utf8');
  assert.ok(stateStore.includes('@typedef'), 'state-store port should declare typedef');
  assert.ok(stateStore.includes('StateStorePort'), 'state-store port typedef name');
  assert.ok(auditSink.includes('AuditEvent'), 'audit-sink should declare AuditEvent');
  assert.ok(auditSink.includes('AuditSinkPort'), 'audit-sink port typedef name');
});
