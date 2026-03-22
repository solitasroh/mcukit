/**
 * GCC ARM .map File Parser & Memory Usage Analyzer
 * @module lib/mcu/memory-analyzer
 * @version 0.2.0
 *
 * .map file structure (GNU LD output):
 * - "Memory Configuration" → FLASH/RAM origin, length
 * - Section sizes: .text, .rodata, .data, .bss
 * - Flash = .text + .rodata + .data (init values)
 * - RAM   = .data + .bss
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse GCC ARM .map file for memory usage
 * @param {string} mapFilePath
 * @returns {Object} Memory analysis result
 */
function parseMapFile(mapFilePath) {
  const content = fs.readFileSync(mapFilePath, 'utf-8');

  const memConfig = parseMemoryConfiguration(content);
  const sections = parseSectionSizes(content);
  const symbols = parseSymbols(content);

  // Calculate usage
  const textSize = getSectionSize(sections, '.text');
  const rodataSize = getSectionSize(sections, '.rodata');
  const dataSize = getSectionSize(sections, '.data');
  const bssSize = getSectionSize(sections, '.bss');

  const flashUsed = textSize + rodataSize + dataSize;
  const ramUsed = dataSize + bssSize;

  const flashTotal = memConfig.FLASH ? memConfig.FLASH.length : 0;
  const ramTotal = memConfig.RAM ? memConfig.RAM.length : 0;

  // Top symbols by size
  const topSymbols = symbols
    .sort((a, b) => b.size - a.size)
    .slice(0, 20);

  return {
    flash: {
      used: flashUsed,
      total: flashTotal,
      percent: flashTotal > 0 ? (flashUsed / flashTotal * 100) : 0,
    },
    ram: {
      used: ramUsed,
      total: ramTotal,
      percent: ramTotal > 0 ? (ramUsed / ramTotal * 100) : 0,
    },
    sections: [
      { name: '.text', size: textSize },
      { name: '.rodata', size: rodataSize },
      { name: '.data', size: dataSize },
      { name: '.bss', size: bssSize },
    ],
    symbols,
    topSymbols,
  };
}

/**
 * Compare current build with previous build
 * @param {Object} current - parseMapFile result
 * @returns {{ flashDelta: number, ramDelta: number, newSymbols: string[], removedSymbols: string[] }}
 */
function compareBuildMemory(current) {
  const { loadBuildHistory } = require('./build-history');
  const history = loadBuildHistory();

  if (!history.history || history.history.length === 0) {
    return { flashDelta: 0, ramDelta: 0, newSymbols: [], removedSymbols: [] };
  }

  const prev = history.history[history.history.length - 1];
  const flashDelta = current.flash.used - (prev.flash ? prev.flash.used : 0);
  const ramDelta = current.ram.used - (prev.ram ? prev.ram.used : 0);

  // Compare top symbols
  const prevNames = new Set((prev.topSymbols || []).map(s => s.name));
  const currNames = new Set(current.topSymbols.map(s => s.name));
  const newSymbols = [...currNames].filter(n => !prevNames.has(n));
  const removedSymbols = [...prevNames].filter(n => !currNames.has(n));

  return { flashDelta, ramDelta, newSymbols, removedSymbols };
}

/**
 * Check memory usage against budget thresholds
 * @param {Object} usage - { flash: { used, total, percent }, ram: { used, total, percent } }
 * @returns {{ passed: boolean, violations: string[] }}
 */
function checkMemoryBudget(usage) {
  const violations = [];

  let flashWarning = 85;
  let ramWarning = 75;

  try {
    const core = require('../core');
    flashWarning = core.getConfig('mcu.memoryBudget.flashWarningPercent', 85);
    ramWarning = core.getConfig('mcu.memoryBudget.ramWarningPercent', 75);
  } catch (_) {}

  if (usage.flash.percent > flashWarning) {
    violations.push(`Flash usage ${usage.flash.percent.toFixed(1)}% exceeds ${flashWarning}% threshold`);
  }
  if (usage.ram.percent > ramWarning) {
    violations.push(`RAM usage ${usage.ram.percent.toFixed(1)}% exceeds ${ramWarning}% threshold`);
  }

  return { passed: violations.length === 0, violations };
}

/**
 * Format memory report for CLI dashboard
 * @param {Object} analysis - parseMapFile result
 * @param {Object|null} delta - compareBuildMemory result
 * @returns {string}
 */
function formatMemoryReport(analysis, delta) {
  const lines = [];

  lines.push('+----- Build Memory Report -------------------------------------------+');
  lines.push('|                                                                      |');

  // Flash bar
  const flashBar = makeProgressBar(analysis.flash.percent, 20);
  const flashKB = (analysis.flash.used / 1024).toFixed(1);
  const flashTotalKB = (analysis.flash.total / 1024).toFixed(0);
  lines.push(`|  Flash: ${flashBar}  ${analysis.flash.percent.toFixed(1)}% (${flashKB}KB / ${flashTotalKB}KB)`.padEnd(71) + '|');

  // RAM bar
  const ramBar = makeProgressBar(analysis.ram.percent, 20);
  const ramKB = (analysis.ram.used / 1024).toFixed(1);
  const ramTotalKB = (analysis.ram.total / 1024).toFixed(0);
  lines.push(`|  RAM:   ${ramBar}  ${analysis.ram.percent.toFixed(1)}% (${ramKB}KB / ${ramTotalKB}KB)`.padEnd(71) + '|');

  lines.push('|                                                                      |');

  // Delta
  if (delta && (delta.flashDelta !== 0 || delta.ramDelta !== 0)) {
    const fSign = delta.flashDelta >= 0 ? '+' : '';
    const rSign = delta.ramDelta >= 0 ? '+' : '';
    const fDeltaKB = (delta.flashDelta / 1024).toFixed(1);
    const rDeltaKB = (delta.ramDelta / 1024).toFixed(1);
    lines.push(`|  Delta Flash: ${fSign}${fDeltaKB}KB  Delta RAM: ${rSign}${rDeltaKB}KB`.padEnd(71) + '|');
    lines.push('|                                                                      |');
  }

  // Budget check
  const budget = checkMemoryBudget(analysis);
  if (!budget.passed) {
    for (const v of budget.violations) {
      lines.push(`|  WARNING: ${v}`.padEnd(71) + '|');
    }
    lines.push('|                                                                      |');
  }

  // Top 5 symbols
  if (analysis.topSymbols && analysis.topSymbols.length > 0) {
    lines.push('|  Top 5 Symbols (by size):'.padEnd(71) + '|');
    for (let i = 0; i < Math.min(5, analysis.topSymbols.length); i++) {
      const s = analysis.topSymbols[i];
      const sizeStr = formatBytes(s.size);
      lines.push(`|    ${i + 1}. ${s.name.substring(0, 30).padEnd(30)} ${sizeStr}`.padEnd(71) + '|');
    }
  }

  lines.push('+----------------------------------------------------------------------+');

  return lines.join('\n');
}

/**
 * Find most recent .map file in project build directories
 * @param {string} projectDir
 * @returns {string|null}
 */
function findMapFile(projectDir) {
  const searchDirs = ['build', 'Debug', 'Release', 'output', 'cmake-build-debug', 'cmake-build-release'];

  for (const dir of searchDirs) {
    const fullDir = path.join(projectDir, dir);
    if (!fs.existsSync(fullDir)) continue;

    try {
      const files = findFilesRecursive(fullDir, '.map', 3);
      if (files.length > 0) {
        // Return most recently modified
        return files.sort((a, b) => {
          return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
        })[0];
      }
    } catch (_) {}
  }

  // Also check project root
  try {
    const rootFiles = fs.readdirSync(projectDir).filter(f => f.endsWith('.map'));
    if (rootFiles.length > 0) {
      return path.join(projectDir, rootFiles[0]);
    }
  } catch (_) {}

  return null;
}

/**
 * Find most recent .elf file
 * @param {string} projectDir
 * @returns {string|null}
 */
function findElfFile(projectDir) {
  const searchDirs = ['build', 'Debug', 'Release', 'output', 'cmake-build-debug'];

  for (const dir of searchDirs) {
    const fullDir = path.join(projectDir, dir);
    if (!fs.existsSync(fullDir)) continue;

    try {
      const files = findFilesRecursive(fullDir, '.elf', 3);
      if (files.length > 0) {
        return files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
      }
    } catch (_) {}
  }

  return null;
}

// ── .map File Parsing Helpers ──

function parseMemoryConfiguration(content) {
  const config = {};
  const memSection = content.match(/Memory Configuration\s*\n\s*Name\s+Origin\s+Length[\s\S]*?\n\n/);
  if (!memSection) return config;

  const lineRegex = /^(\w+)\s+(0x[0-9a-fA-F]+)\s+(0x[0-9a-fA-F]+)/gm;
  let match;
  while ((match = lineRegex.exec(memSection[0])) !== null) {
    const name = match[1];
    if (name === 'Name' || name === '*default*') continue;
    config[name] = {
      origin: parseInt(match[2], 16),
      length: parseInt(match[3], 16),
    };
  }

  return config;
}

function parseSectionSizes(content) {
  const sections = [];

  // Look for section fill summary at the end of .map
  // Format: .text    0x08000000    0x1234
  const sectionRegex = /^\.(text|rodata|data|bss|ARM)\s+(0x[0-9a-fA-F]+)\s+(0x[0-9a-fA-F]+)/gm;
  let match;
  while ((match = sectionRegex.exec(content)) !== null) {
    const name = '.' + match[1];
    const size = parseInt(match[3], 16);
    // Avoid duplicates - keep the larger one
    const existing = sections.find(s => s.name === name);
    if (existing) {
      if (size > existing.size) existing.size = size;
    } else {
      sections.push({ name, address: parseInt(match[2], 16), size });
    }
  }

  return sections;
}

function parseSymbols(content) {
  const symbols = [];
  // Pattern: 0x08001234  0x00000100  object_name
  const symbolRegex = /^\s+(0x[0-9a-fA-F]+)\s+(0x[0-9a-fA-F]+)\s+(\S+\.(o|a)\((.+)\))/gm;
  let match;
  while ((match = symbolRegex.exec(content)) !== null) {
    const size = parseInt(match[2], 16);
    if (size > 0) {
      symbols.push({
        name: match[5] || match[3],
        size,
        section: 'unknown',
      });
    }
  }

  return symbols;
}

function getSectionSize(sections, name) {
  const section = sections.find(s => s.name === name);
  return section ? section.size : 0;
}

// ── General Helpers ──

function makeProgressBar(percent, width) {
  const filled = Math.round(percent / 100 * width);
  const empty = width - filled;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  return bar;
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function findFilesRecursive(dir, ext, maxDepth, depth = 0) {
  if (depth >= maxDepth) return [];
  const results = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(fullPath);
      } else if (entry.isDirectory() && depth < maxDepth - 1) {
        results.push(...findFilesRecursive(fullPath, ext, maxDepth, depth + 1));
      }
    }
  } catch (_) {}

  return results;
}

module.exports = {
  parseMapFile,
  parseSizeOutput: require('./toolchain').parseSizeOutput,
  compareBuildMemory,
  checkMemoryBudget,
  formatMemoryReport,
  findMapFile,
  findElfFile,
};
