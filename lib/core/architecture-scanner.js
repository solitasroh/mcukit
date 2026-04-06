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

  // Directories of interest in common architectures
  const targetDirs = ['src', 'lib', 'include', 'Core', 'App', 'ViewModels', 'Models', 'Views', 'drivers', 'application', 'features'];
  let fileCount = 0;

  try {
    for (const dir of targetDirs) {
      const fullPath = path.join(PROJECT_DIR, dir);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
        const files = fs.readdirSync(fullPath, { recursive: true })
          .filter(f => {
            const ext = path.extname(f).toLowerCase();
            return ['.c', '.cpp', '.h', '.hpp', '.cs', '.js', '.ts', '.xaml'].includes(ext);
          })
          .map(f => f.split(path.sep).join('/')); // Normalize path

        if (files.length > 0) {
          result.modules.push({ directory: dir, files });
          fileCount += files.length;
        }
      }
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
    return "Status: **ZERO-CODEBASE DETECTED**\nAction: No existing architecture found. You are bootstrapping a new project. Use base framework templates (from `refs/`) to design the holistic application architecture diagram from scratch.";
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
