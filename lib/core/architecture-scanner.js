/**
 * Global Architecture Context Scanner
 * @module lib/core/architecture-scanner
 * @version 1.0.0
 * 
 * Scans the target workspace to generate a structural map for context injection.
 * Detects "Zero-Codebase" (Greenfield) scenarios to trigger bootstrap mode.
 */

const fs = require('fs');
const path = require('path');
const core = require('./index');

/**
 * Perform a lightweight scan of the project directory to map the architecture.
 * We avoid full AST parsing and instead focus on structural directories and files.
 * @returns {Object} Architecture map containing modules and zeroCodebase flag.
 */
function scanArchitecture() {
  const { PROJECT_DIR, debugLog } = core;
  const result = {
    modules: [],
    zeroCodebase: false,
    timestamp: new Date().toISOString()
  };

  if (!PROJECT_DIR || !fs.existsSync(PROJECT_DIR)) {
    result.zeroCodebase = true;
    return result;
  }

  const ignoredDirs = new Set([
    'node_modules', '.git', '.vscode', '.vs', '.idea',
    'bin', 'obj', 'build', 'debug', 'release', 'out', 'target', 
    'vendors', 'middlewares', 'packages', 'assets', 'resources', 'docs',
    'tmp', 'cache'
  ]);
  const extWhitelist = new Set(['.c', '.cpp', '.h', '.hpp', '.cs', '.js', '.ts', '.xaml', '.py']);
  
  const dirMap = {};
  let fileCount = 0;

  function walk(currentDir, depth) {
    if (depth > 4) return; // Limit depth to avoid scanning massive repos forever
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch { return; }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name.toLowerCase())) {
          walk(path.join(currentDir, entry.name), depth + 1);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extWhitelist.has(ext)) {
          const relPath = path.relative(PROJECT_DIR, path.join(currentDir, entry.name)).split(path.sep).join('/');
          const dirName = path.dirname(relPath) === '.' ? '/' : path.dirname(relPath);
          const baseName = path.basename(relPath);
          
          if (!dirMap[dirName]) dirMap[dirName] = [];
          dirMap[dirName].push(baseName);
          fileCount++;
        }
      }
    }
  }

  try {
    walk(PROJECT_DIR, 0);

    for (const [dir, files] of Object.entries(dirMap)) {
      result.modules.push({ directory: dir, files });
    }

    // Heuristic: If we found fewer than 2 structural files, we consider it a zero-codebase project.
    if (fileCount < 2) {
      result.zeroCodebase = true;
      debugLog('scanner', 'Zero-codebase detected (fewer than 2 structural files found).');
    } else {
      debugLog('scanner', `Mapped architecture: ${fileCount} files across ${result.modules.length} directories.`);
    }

    return result;
  } catch (error) {
    debugLog('scanner', `Scanner error: ${error.message}`);
    result.zeroCodebase = true;
    return result;
  }
}

/**
 * Formats the architecture map into a string suitable for prompt injection.
 * @param {Object} map The object returned by scanArchitecture()
 * @returns {string} Formatted markdown text
 */
function formatArchitectureForPrompt(map) {
  if (!map || map.zeroCodebase) {
    let refsInfo = "Status: **ZERO-CODEBASE DETECTED**\nAction: No existing architecture found. You are bootstrapping a new project. Use base framework templates (from `refs/`) to design the holistic application architecture diagram from scratch.\n";
    try {
      const fs = require('fs');
      const path = require('path');
      const rootDir = path.resolve(__dirname, '../../');
      const refsPath = path.join(rootDir, 'refs');
      if (fs.existsSync(refsPath)) {
        refsInfo += "\nAvailable Reference Templates in `refs/`:\n";
        for (const dir of fs.readdirSync(refsPath)) {
          const fullDir = path.join(refsPath, dir);
          if (fs.statSync(fullDir).isDirectory()) {
            const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.md'));
            if (files.length > 0) {
              refsInfo += `- **refs/${dir}/**: ${files.join(', ')}\n`;
            }
          }
        }
      }
    } catch (err) {
      // Ignore if filesystem fails
    }
    return refsInfo;
  }

  let text = "### Existing System Architecture Map\n";
  text += "The following modules and interfaces already exist. You MUST reuse them or extend them to prevent duplication:\n\n";

  for (const mod of map.modules) {
    text += `- **${mod.directory}/**\n`;
    const sorted = mod.files.sort();
    // Limit to prevent context bloat (max 10 files per dir)
    for (const f of sorted.slice(0, 10)) {
      text += `  - ${f}\n`;
    }
    if (sorted.length > 10) {
      text += `  - ... and ${sorted.length - 10} more files.\n`;
    }
  }

  return text;
}

module.exports = {
  scanArchitecture,
  formatArchitectureForPrompt
};
