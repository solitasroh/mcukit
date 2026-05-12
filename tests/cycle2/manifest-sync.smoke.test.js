// Cycle 2 FR-10 policies/manifest.json sync tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname || '.', '..', '..');

function listPoliciesJson() {
  const out = [];
  function walk(dir, prefix) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), rel);
      else if (e.name.endsWith('.json')) out.push(rel);
    }
  }
  walk(path.join(ROOT, 'policies'), '');
  return out;
}

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'policies/manifest.json'), 'utf8'));
const registered = new Set(manifest.sots.map((s) => s.path));
const actual = listPoliciesJson();

test('TC-39: every policies/*.json registered in manifest', () => {
  for (const f of actual) {
    assert.ok(registered.has(f), `${f} not registered in manifest.sots[]`);
  }
});

test('every manifest entry has corresponding file', () => {
  for (const r of registered) {
    assert.ok(actual.includes(r), `manifest references missing file: ${r}`);
  }
});

test('manifest entries have required fields', () => {
  for (const s of manifest.sots) {
    assert.ok(s.path, 'sots[].path required');
    assert.ok(s.since, `sots[${s.path}].since required`);
    assert.ok(s.version, `sots[${s.path}].version required`);
    assert.ok(s.description, `sots[${s.path}].description required`);
  }
});
