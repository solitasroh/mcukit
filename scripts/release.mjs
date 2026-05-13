#!/usr/bin/env node
/**
 * release.mjs — atomic rkit plugin release tool.
 *
 * 1. Validates new version (semver Major.Minor.Patch)
 * 2. Bumps version in 4 SoT files atomically:
 *    - package.json
 *    - .claude-plugin/plugin.json
 *    - .claude-plugin/marketplace.json (metadata.version + plugins[0].version)
 *    - hooks/hooks.json (description field "rkit vX.Y.Z — ...")
 * 3. Verifies invariant via scanVersions() — mismatches must be 0
 * 4. Reminds caller of remaining manual steps (README badge, CHANGELOG, tag, push)
 *
 * Usage:
 *   node scripts/release.mjs 0.9.15           # bump + verify
 *   node scripts/release.mjs 0.9.15 --check   # verify-only (no write)
 *   node scripts/release.mjs --status         # show current versions
 *
 * Exit codes:
 *   0 — bump + verify OK
 *   1 — mismatch or write failure
 *   2 — usage error
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const FILES = {
  pkg: path.join(ROOT, 'package.json'),
  plugin: path.join(ROOT, '.claude-plugin/plugin.json'),
  marketplace: path.join(ROOT, '.claude-plugin/marketplace.json'),
  hooks: path.join(ROOT, 'hooks/hooks.json'),
  readme: path.join(ROOT, 'README.md'),
};

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function currentVersions() {
  return {
    pkg: readJson(FILES.pkg).version,
    plugin: readJson(FILES.plugin).version,
    marketplaceMeta: readJson(FILES.marketplace).metadata?.version,
    marketplacePlugin: readJson(FILES.marketplace).plugins?.[0]?.version,
    hooksDesc: (readJson(FILES.hooks).description || '').match(/v(\d+\.\d+\.\d+)/)?.[1] || null,
    readmeBadge: (() => {
      try {
        const m = fs.readFileSync(FILES.readme, 'utf8').match(/Version-(\d+\.\d+\.\d+)/);
        return m ? m[1] : null;
      } catch { return null; }
    })(),
  };
}

function printStatus() {
  const v = currentVersions();
  console.log('Current versions:');
  for (const [k, val] of Object.entries(v)) {
    console.log(`  ${k.padEnd(20)} ${val ?? '(none)'}`);
  }
  const unique = new Set(Object.values(v).filter(Boolean));
  if (unique.size === 1) {
    console.log(`\n✅ all aligned at ${[...unique][0]}`);
  } else {
    console.log(`\n⚠️  mismatch — ${unique.size} distinct values: ${[...unique].join(', ')}`);
  }
}

function bump(newVersion, opts = { check: false }) {
  const before = currentVersions();
  const writes = [];

  // package.json
  const pkg = readJson(FILES.pkg);
  pkg.version = newVersion;
  writes.push(() => writeJson(FILES.pkg, pkg));

  // plugin.json
  const plugin = readJson(FILES.plugin);
  plugin.version = newVersion;
  writes.push(() => writeJson(FILES.plugin, plugin));

  // marketplace.json (two version fields)
  const market = readJson(FILES.marketplace);
  if (market.metadata) market.metadata.version = newVersion;
  if (Array.isArray(market.plugins) && market.plugins[0]) market.plugins[0].version = newVersion;
  writes.push(() => writeJson(FILES.marketplace, market));

  // hooks.json description (regex replace)
  const hooks = readJson(FILES.hooks);
  if (hooks.description) {
    hooks.description = hooks.description.replace(/v\d+\.\d+\.\d+/, `v${newVersion}`);
  }
  writes.push(() => writeJson(FILES.hooks, hooks));

  // README.md badge (regex replace, optional file)
  let readmeChanged = false;
  if (fs.existsSync(FILES.readme)) {
    const readmeBefore = fs.readFileSync(FILES.readme, 'utf8');
    const readmeAfter = readmeBefore.replace(
      /Version-\d+\.\d+\.\d+-blue/g,
      `Version-${newVersion}-blue`
    ).replace(
      /Version-\d+\.\d+\.\d+/g,
      `Version-${newVersion}`
    );
    if (readmeAfter !== readmeBefore) {
      writes.push(() => fs.writeFileSync(FILES.readme, readmeAfter, 'utf8'));
      readmeChanged = true;
    }
  }

  if (opts.check) {
    console.log('--check mode: no writes performed.');
    console.log('Would change:');
    for (const [k, v] of Object.entries(before)) {
      if (v !== newVersion) console.log(`  ${k.padEnd(20)} ${v ?? '(none)'} → ${newVersion}`);
    }
    if (readmeChanged) console.log(`  ${'readmeBadge'.padEnd(20)} → ${newVersion}`);
    return 0;
  }

  for (const fn of writes) fn();
  const after = currentVersions();
  console.log('After bump:');
  for (const [k, v] of Object.entries(after)) console.log(`  ${k.padEnd(20)} ${v}`);

  const unique = new Set(Object.values(after).filter(Boolean));
  if (unique.size !== 1 || ![...unique][0] === newVersion) {
    console.error(`\n❌ post-bump mismatch — ${[...unique].join(', ')}`);
    return 1;
  }

  console.log(`\n✅ All version fields aligned at ${newVersion}`);
  console.log('\nNext steps:');
  console.log('  1. Update CHANGELOG.md + docs/04-report/changelog.md');
  console.log('  2. git add . && git commit -m "' + newVersion + '"');
  console.log('  3. git tag v' + newVersion + ' -m "rkit v' + newVersion + '"');
  console.log('  4. git push origin main && git push origin v' + newVersion);
  console.log('  5. gh release create v' + newVersion + ' --title "rkit v' + newVersion + '" --notes "..."');
  return 0;
}

// ─── main ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);

if (argv.includes('--status')) {
  printStatus();
  process.exit(0);
}

const versionArg = argv.find((a) => SEMVER_RE.test(a));
if (!versionArg) {
  console.error('Usage:');
  console.error('  node scripts/release.mjs <version>          # bump + verify');
  console.error('  node scripts/release.mjs <version> --check  # dry-run');
  console.error('  node scripts/release.mjs --status           # show current state');
  console.error('\nExample: node scripts/release.mjs 0.9.15');
  process.exit(2);
}

const check = argv.includes('--check');
const code = bump(versionArg, { check });
process.exit(code);
