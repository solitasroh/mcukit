// Cycle 2 FR-11 decisions matrix sanity tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const matrix = JSON.parse(fs.readFileSync('policies/decisions/cycle2-matrix.json', 'utf8'));

test('TC-2: matrix has exactly 11 candidates', () => {
  assert.equal(matrix.candidates.length, 11);
});

test('TC-3: decision_enum has 5 values', () => {
  assert.deepEqual(matrix.decision_enum, ['pending', 'adopt', 'partial_adopt', 'defer', 'reject']);
});

test('decided_by_schema declared', () => {
  assert.ok(matrix.decided_by_schema);
  assert.deepEqual(matrix.decided_by_schema.role_enum, ['human', 'agent']);
});

test('completion_gate references verify-policy decisions-matrix', () => {
  assert.match(matrix.completion_gate.check, /decisions-matrix/);
});

test('initial state: all candidates pending', () => {
  for (const c of matrix.candidates) {
    assert.equal(c.decision, 'pending', `${c.id} should be pending initially`);
  }
});

test('P0 candidates: A, B, CO-4', () => {
  const p0 = matrix.candidates.filter((c) => c.priority === 'P0').map((c) => c.id);
  assert.deepEqual(p0.sort(), ['A', 'B', 'CO-4'].sort());
});

test('B depends on A', () => {
  const b = matrix.candidates.find((c) => c.id === 'B');
  assert.deepEqual(b.depends_on, ['A']);
});
