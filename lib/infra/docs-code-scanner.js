/**
 * Docs=Code Cross-Check Scanner — Infrastructure Adapter.
 *
 * Cycle 2 F partial_adopt — sourced from bkit lib/infra/docs-code-scanner.js.
 * Adapted for rkit: bkit_ → rkit_ MCP tool prefix. Canonical version source
 * is package.json (NOT rkit.config.json — that file holds a subsystem version
 * unrelated to plugin release). plugin.json + README + CHANGELOG must agree
 * with package.json.
 *
 * Scope: measure() + scanVersions() only. crossCheck() requires
 * lib/domain/rules/docs-code-invariants.js (Cycle 2 candidate B deferred —
 * rkit ENH counts not yet declared). When B advances in cycle-3+, restore
 * crossCheck() against rkit-side EXPECTED_COUNTS.
 *
 * Safety: all reads are offline filesystem scans — no network egress, no
 * shell spawn. Compatible with policies/network-allowlist.json.
 *
 * @module lib/infra/docs-code-scanner
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Count entries in skills/ directory (direct children containing SKILL.md).
 * @returns {number}
 */
function countSkills() {
  const dir = path.join(PROJECT_ROOT, 'skills');
  if (!fs.existsSync(dir)) return 0;
  return fs
    .readdirSync(dir)
    .filter((d) => {
      try {
        const sub = path.join(dir, d);
        return fs.statSync(sub).isDirectory() && fs.existsSync(path.join(sub, 'SKILL.md'));
      } catch {
        return false;
      }
    }).length;
}

function countAgents() {
  const dir = path.join(PROJECT_ROOT, 'agents');
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).length;
}

function countHooks() {
  const hooksJson = path.join(PROJECT_ROOT, 'hooks', 'hooks.json');
  if (!fs.existsSync(hooksJson)) return { events: 0, blocks: 0 };
  const data = JSON.parse(fs.readFileSync(hooksJson, 'utf8'));
  const events = Object.keys(data.hooks || {}).length;
  let blocks = 0;
  for (const [, entries] of Object.entries(data.hooks || {})) {
    blocks += entries.length;
  }
  return { events, blocks };
}

function countMCPServers() {
  const dir = path.join(PROJECT_ROOT, 'servers');
  if (!fs.existsSync(dir)) return 0;
  return fs
    .readdirSync(dir)
    .filter((d) => fs.statSync(path.join(dir, d)).isDirectory()).length;
}

function countMCPTools() {
  const dir = path.join(PROJECT_ROOT, 'servers');
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const servers = fs.readdirSync(dir).filter((s) => fs.statSync(path.join(dir, s)).isDirectory());
  for (const server of servers) {
    const indexPath = path.join(dir, server, 'index.js');
    if (!fs.existsSync(indexPath)) continue;
    const source = fs.readFileSync(indexPath, 'utf8');
    const matches = source.match(/(?:^|[\s{,])["']?name["']?\s*:\s*['"](rkit_[a-z_]+)['"]/gm) || [];
    const names = new Set();
    for (const m of matches) {
      const inner = m.match(/['"](rkit_[a-z_]+)['"]/);
      if (inner) names.add(inner[1]);
    }
    total += names.size;
  }
  return total;
}

function countLibModules() {
  const dir = path.join(PROJECT_ROOT, 'lib');
  if (!fs.existsSync(dir)) return 0;
  function walk(p) {
    let n = 0;
    for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, entry.name);
      if (entry.isDirectory()) n += walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) n++;
    }
    return n;
  }
  return walk(dir);
}

function countScripts() {
  const dir = path.join(PROJECT_ROOT, 'scripts');
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js')).length;
}

/**
 * Measure the current inventory.
 * @returns {Promise<{skills:number, agents:number, hookEvents:number, hookBlocks:number, mcpServers:number, mcpTools:number, libModules:number, scripts:number}>}
 */
async function measure() {
  const hooks = countHooks();
  return {
    skills: countSkills(),
    agents: countAgents(),
    hookEvents: hooks.events,
    hookBlocks: hooks.blocks,
    mcpServers: countMCPServers(),
    mcpTools: countMCPTools(),
    libModules: countLibModules(),
    scripts: countScripts(),
  };
}

/**
 * Version invariant scan across rkit version-declaring files.
 *
 * Canonical source: **package.json:version** (rkit plugin release version,
 * consumed by hooks/session-start.js `require('../package.json').version`).
 *
 * Cross-checks:
 *   - .claude-plugin/plugin.json:version
 *   - README.md badge `Version-X.Y.Z`
 *   - CHANGELOG.md latest `## [X.Y.Z]` header
 *   - hooks.json description string (approximate)
 *
 * Note: rkit.config.json:version is a separate subsystem version (currently
 * 0.1.0) tracking the rkit.config schema — intentionally NOT canonical.
 *
 * @returns {Promise<{canonical:string|null, packageJson:string|null, pluginJson:string|null, readme:string|null, changelog:string|null, hooksJson:string|null, mismatches:Array<{file:string, field:string, declared:string|null}>}>}
 */
async function scanVersions() {
  function readJSONField(relPath, field) {
    try {
      const full = path.join(PROJECT_ROOT, relPath);
      if (!fs.existsSync(full)) return null;
      const data = JSON.parse(fs.readFileSync(full, 'utf8'));
      return data && typeof data[field] === 'string' ? data[field] : null;
    } catch {
      return null;
    }
  }

  const packageJson = readJSONField('package.json', 'version');
  const pluginJson = readJSONField('.claude-plugin/plugin.json', 'version');

  let readme = null;
  try {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, 'README.md'), 'utf8');
    const m = content.match(/Version-(\d+\.\d+\.\d+)/);
    readme = m ? m[1] : null;
  } catch { /* ignore */ }

  let changelog = null;
  try {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, 'CHANGELOG.md'), 'utf8');
    const m = content.match(/^\s*##\s*\[?(\d+\.\d+\.\d+)\]?/m);
    changelog = m ? m[1] : null;
  } catch { /* ignore */ }

  let hooksJson = null;
  try {
    const content = fs.readFileSync(path.join(PROJECT_ROOT, 'hooks', 'hooks.json'), 'utf8');
    const m = content.match(/v(\d+\.\d+\.\d+)/);
    hooksJson = m ? m[1] : null;
  } catch { /* ignore */ }

  const canonical = packageJson;
  const mismatches = [];
  if (canonical) {
    if (pluginJson !== null && pluginJson !== canonical) mismatches.push({ file: '.claude-plugin/plugin.json', field: 'version', declared: pluginJson });
    if (readme !== null && readme !== canonical) mismatches.push({ file: 'README.md', field: 'badge', declared: readme });
    if (changelog !== null && changelog !== canonical) mismatches.push({ file: 'CHANGELOG.md', field: 'top-header', declared: changelog });
    if (hooksJson !== null && hooksJson !== canonical) mismatches.push({ file: 'hooks/hooks.json', field: 'description', declared: hooksJson });
  }

  return { canonical, packageJson, pluginJson, readme, changelog, hooksJson, mismatches };
}

module.exports = {
  measure,
  scanVersions,
  // helpers (testing)
  countSkills,
  countAgents,
  countHooks,
  countMCPServers,
  countMCPTools,
  countLibModules,
  countScripts,
};
