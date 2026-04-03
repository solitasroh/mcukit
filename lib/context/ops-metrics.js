/**
 * Ops Metrics - Build time, binary size, and operational metric collection
 * @module lib/context/ops-metrics
 * @version 2.0.5
 *
 * Collects domain-specific metrics (build duration, binary size, etc.)
 * and persists benchmark history for trend analysis.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Lazy require paths to avoid circular dependency
let _paths = null;
function getPaths() {
  if (!_paths) { _paths = require('../core/paths'); }
  return _paths;
}

/**
 * Collect operational metrics for a domain
 * @param {string} domain - Domain identifier (mcu/mpu/wpf)
 * @param {string} projectDir - Absolute path to project root
 * @returns {{ domain: string, timestamp: string, metrics: Object }}
 */
function collectMetrics(domain, projectDir) {
  var timestamp = new Date().toISOString();
  var metrics = {
    domain: domain,
    timestamp: timestamp,
    buildTime: null,
    binarySize: null,
    custom: {},
  };

  if (domain === 'mcu') {
    metrics.binarySize = collectMcuSize(projectDir);
  } else if (domain === 'mpu') {
    metrics.custom.dtsCount = countFilesByExtension(projectDir, '.dts');
    metrics.custom.recipeCount = countFilesByExtension(projectDir, '.bb');
  } else if (domain === 'wpf') {
    metrics.binarySize = collectWpfSize(projectDir);
  }

  return metrics;
}

/**
 * Save metrics to benchmark history
 * @param {Object} metrics - Metrics object from collectMetrics
 * @returns {{ saved: boolean, path: string }}
 */
function saveBenchmark(metrics) {
  var historyPath = getBenchmarkPath();
  var result = { saved: false, path: historyPath };

  try {
    var dir = path.dirname(historyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    var history = [];
    if (fs.existsSync(historyPath)) {
      try {
        history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      } catch (e) {
        history = [];
      }
    }

    history.push(metrics);

    // Keep last 100 entries
    if (history.length > 100) {
      history = history.slice(-100);
    }

    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    result.saved = true;
  } catch (e) {
    result.error = e.message;
  }

  return result;
}

/**
 * Load benchmark history
 * @returns {Object[]} Array of historical metric records
 */
function loadBenchmarkHistory() {
  var historyPath = getBenchmarkPath();

  try {
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    }
  } catch (e) {
    // Corrupted file — return empty
  }

  return [];
}

// ── Internal Helpers ──────────────────────────────────────────────

/**
 * Get benchmark history file path using STATE_PATHS
 * @returns {string}
 */
function getBenchmarkPath() {
  try {
    var paths = getPaths();
    return path.join(paths.STATE_PATHS.state(), 'benchmark-history.json');
  } catch (e) {
    // Fallback if paths module unavailable
    return path.join(process.cwd(), '.rkit', 'state', 'benchmark-history.json');
  }
}

/**
 * Collect MCU binary size via arm-none-eabi-size
 * @param {string} projectDir
 * @returns {{ text: number, data: number, bss: number, total: number }|null}
 */
function collectMcuSize(projectDir) {
  var buildDir = path.join(projectDir, 'build');
  try {
    var elfFiles = [];
    if (fs.existsSync(buildDir)) {
      var entries = fs.readdirSync(buildDir);
      for (var i = 0; i < entries.length; i++) {
        if (/\.elf$/.test(entries[i])) {
          elfFiles.push(path.join(buildDir, entries[i]));
        }
      }
    }

    if (elfFiles.length === 0) return null;

    var output = execSync('arm-none-eabi-size "' + elfFiles[0] + '"', {
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 10000,
    });

    // Parse arm-none-eabi-size output:
    //   text    data     bss     dec     hex filename
    //  12345    1234     567   14136    3738 firmware.elf
    var lines = output.trim().split('\n');
    if (lines.length >= 2) {
      var parts = lines[1].trim().split(/\s+/);
      if (parts.length >= 4) {
        return {
          text: parseInt(parts[0], 10),
          data: parseInt(parts[1], 10),
          bss: parseInt(parts[2], 10),
          total: parseInt(parts[3], 10),
        };
      }
    }
  } catch (e) {
    // arm-none-eabi-size not available or no ELF files
  }

  return null;
}

/**
 * Collect WPF binary size
 * @param {string} projectDir
 * @returns {{ totalBytes: number, files: number }|null}
 */
function collectWpfSize(projectDir) {
  var publishDir = path.join(projectDir, 'bin', 'Release');
  try {
    if (!fs.existsSync(publishDir)) return null;

    var totalBytes = 0;
    var fileCount = 0;

    function walkDir(dir) {
      var entries = fs.readdirSync(dir, { withFileTypes: true });
      for (var i = 0; i < entries.length; i++) {
        var fullPath = path.join(dir, entries[i].name);
        if (entries[i].isDirectory()) {
          walkDir(fullPath);
        } else if (entries[i].isFile()) {
          var stat = fs.statSync(fullPath);
          totalBytes += stat.size;
          fileCount++;
        }
      }
    }

    walkDir(publishDir);
    return { totalBytes: totalBytes, files: fileCount };
  } catch (e) {
    // Directory not accessible
  }

  return null;
}

/**
 * Count files by extension in project directory (1-level deep)
 * @param {string} projectDir
 * @param {string} ext
 * @returns {number}
 */
function countFilesByExtension(projectDir, ext) {
  var count = 0;
  try {
    var entries = fs.readdirSync(projectDir, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isFile() && entries[i].name.endsWith(ext)) {
        count++;
      } else if (entries[i].isDirectory() && !entries[i].name.startsWith('.')) {
        try {
          var subEntries = fs.readdirSync(path.join(projectDir, entries[i].name));
          for (var j = 0; j < subEntries.length; j++) {
            if (subEntries[j].endsWith(ext)) count++;
          }
        } catch (e) { /* skip */ }
      }
    }
  } catch (e) { /* skip */ }
  return count;
}

module.exports = {
  collectMetrics,
  saveBenchmark,
  loadBenchmarkHistory,
};
