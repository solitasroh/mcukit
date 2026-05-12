// Cycle 2 FR-12 status schema compatibility tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname || '.', '..', '..');

function loadArchivedFeatures() {
  const archiveRoot = path.join(ROOT, 'docs/archive');
  if (!fs.existsSync(archiveRoot)) return [];
  const features = [];
  for (const month of fs.readdirSync(archiveRoot, { withFileTypes: true })) {
    if (!month.isDirectory()) continue;
    const indexPath = path.join(archiveRoot, month.name, '_INDEX.md');
    if (!fs.existsSync(indexPath)) continue;
    const txt = fs.readFileSync(indexPath, 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\|\s*([a-z0-9][a-z0-9-]*)\s*\|/);
      if (!m || m[1] === 'feature') continue;
      features.push({ id: m[1], month: month.name });
    }
  }
  return features;
}

test('TC-25: dynamic ARCHIVED discovery (no hardcoded list)', () => {
  const archived = loadArchivedFeatures();
  assert.ok(archived.length > 0, 'should find archived features dynamically');
});

test('cycle-1 + cycle-1.5 archives discovered', () => {
  const archived = loadArchivedFeatures();
  const ids = archived.map((a) => a.id);
  assert.ok(ids.includes('bkit-gstack-sync-v2'), 'cycle-1 archive expected');
  assert.ok(ids.includes('bkit-gstack-sync-v2-cycle15'), 'cycle-1.5 archive expected');
});

test('discovery yields at least 13 historical features', () => {
  // baseline 13 = 2026-04 _INDEX.md count after cycle 1.5 archive
  const archived = loadArchivedFeatures();
  assert.ok(archived.length >= 13, `expected >=13 historical, got ${archived.length}`);
});
