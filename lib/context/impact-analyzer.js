/**
 * Impact Analyzer - Change impact analysis across MCU/MPU/WPF domains
 * @module lib/context/impact-analyzer
 * @version 2.0.5
 *
 * Analyzes changed files to determine impact scope.
 * Domain-specific strategies for MCU (linker/memory), MPU (DTS), WPF (csproj).
 */

const fs = require('fs');
const path = require('path');

// Optional domain detector — graceful fallback if unavailable
let _detector = null;
function getDetector() {
  if (!_detector) {
    try { _detector = require('../domain/detector'); } catch (e) { _detector = null; }
  }
  return _detector;
}

/**
 * Analyze impact of changed files
 * @param {string[]} changedFiles - List of changed file paths
 * @param {string} [domain] - Domain override (mcu/mpu/wpf). Auto-detected if omitted.
 * @returns {{ domain: string, impacts: Object[], summary: string }}
 */
function analyzeImpact(changedFiles, domain) {
  if (!changedFiles || changedFiles.length === 0) {
    return { domain: domain || 'unknown', impacts: [], summary: 'No changed files provided.' };
  }

  // Auto-detect domain if not specified
  if (!domain) {
    const detector = getDetector();
    if (detector && typeof detector.detectDomain === 'function') {
      try {
        const detected = detector.detectDomain();
        domain = detected && detected.domain ? detected.domain : 'unknown';
      } catch (e) {
        domain = 'unknown';
      }
    } else {
      domain = 'unknown';
    }
  }

  const impacts = [];

  // Domain-specific analysis
  if (domain === 'mcu') {
    const memImpact = getMemoryImpact(changedFiles);
    if (memImpact.affected) impacts.push(memImpact);
  } else if (domain === 'mpu') {
    const dtsImpact = getDtsImpact(changedFiles);
    if (dtsImpact.affected) impacts.push(dtsImpact);
  } else if (domain === 'wpf') {
    const depImpact = getDependencyImpact(changedFiles);
    if (depImpact.affected) impacts.push(depImpact);
  }

  // Generic impact: header/source coupling
  const headerChanges = changedFiles.filter(function (f) { return /\.(h|hpp)$/.test(f); });
  if (headerChanges.length > 0) {
    impacts.push({
      type: 'header-change',
      affected: true,
      files: headerChanges,
      risk: 'medium',
      description: headerChanges.length + ' header file(s) changed — may require recompilation of dependent sources.',
    });
  }

  // Build file changes
  var buildFiles = changedFiles.filter(function (f) {
    return /CMakeLists\.txt$|\.cmake$|Makefile$|\.csproj$|\.bb$|\.bbappend$/.test(f);
  });
  if (buildFiles.length > 0) {
    impacts.push({
      type: 'build-config-change',
      affected: true,
      files: buildFiles,
      risk: 'high',
      description: 'Build configuration changed — full rebuild recommended.',
    });
  }

  var summary = impacts.length === 0
    ? 'No significant impacts detected.'
    : impacts.length + ' impact(s) detected: ' + impacts.map(function (i) { return i.type; }).join(', ');

  return { domain: domain, impacts: impacts, summary: summary };
}

/**
 * MCU: Analyze Flash/RAM impact from linker script changes
 * @param {string[]} changedFiles
 * @returns {{ type: string, affected: boolean, files: string[], sections: Object[], risk: string, description: string }}
 */
function getMemoryImpact(changedFiles) {
  var ldFiles = changedFiles.filter(function (f) { return /\.ld$/.test(f); });
  var result = {
    type: 'memory-layout',
    affected: ldFiles.length > 0,
    files: ldFiles,
    sections: [],
    risk: 'high',
    description: '',
  };

  if (!result.affected) return result;

  for (var i = 0; i < ldFiles.length; i++) {
    try {
      var content = fs.readFileSync(ldFiles[i], 'utf8');
      // Parse MEMORY block
      var memBlock = content.match(/MEMORY\s*\{([\s\S]*?)\}/);
      if (memBlock) {
        var lines = memBlock[1].split('\n');
        for (var j = 0; j < lines.length; j++) {
          var line = lines[j].trim();
          // e.g., FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 512K
          var m = line.match(/(\w+)\s*\([^)]*\)\s*:\s*ORIGIN\s*=\s*(0x[\da-fA-F]+)\s*,\s*LENGTH\s*=\s*(\d+[KMG]?)/i);
          if (m) {
            result.sections.push({
              name: m[1],
              origin: m[2],
              length: m[3],
              file: ldFiles[i],
            });
          }
        }
      }
    } catch (e) {
      // File unreadable — skip
    }
  }

  result.description = 'Linker script changed — Flash/RAM layout may be affected. '
    + result.sections.length + ' memory section(s) parsed.';

  return result;
}

/**
 * MPU: Analyze Device Tree Source changes
 * @param {string[]} changedFiles
 * @returns {{ type: string, affected: boolean, files: string[], nodes: string[], risk: string, description: string }}
 */
function getDtsImpact(changedFiles) {
  var dtsFiles = changedFiles.filter(function (f) { return /\.(dts|dtsi)$/.test(f); });
  var result = {
    type: 'device-tree',
    affected: dtsFiles.length > 0,
    files: dtsFiles,
    nodes: [],
    risk: 'high',
    description: '',
  };

  if (!result.affected) return result;

  for (var i = 0; i < dtsFiles.length; i++) {
    try {
      var content = fs.readFileSync(dtsFiles[i], 'utf8');
      // Extract top-level and important node names
      var nodeMatches = content.match(/^\s*([a-zA-Z_][\w@,-]*)\s*\{/gm);
      if (nodeMatches) {
        for (var j = 0; j < nodeMatches.length; j++) {
          var nodeName = nodeMatches[j].replace(/\s*\{$/, '').trim();
          if (result.nodes.indexOf(nodeName) === -1) {
            result.nodes.push(nodeName);
          }
        }
      }
    } catch (e) {
      // File unreadable — skip
    }
  }

  result.description = dtsFiles.length + ' DTS file(s) changed — '
    + result.nodes.length + ' node(s) affected. dtc validation recommended.';

  return result;
}

/**
 * WPF: Analyze .csproj dependency changes
 * @param {string[]} changedFiles
 * @returns {{ type: string, affected: boolean, files: string[], packages: string[], risk: string, description: string }}
 */
function getDependencyImpact(changedFiles) {
  var csprojFiles = changedFiles.filter(function (f) { return /\.csproj$/.test(f); });
  var result = {
    type: 'nuget-dependency',
    affected: csprojFiles.length > 0,
    files: csprojFiles,
    packages: [],
    risk: 'medium',
    description: '',
  };

  if (!result.affected) return result;

  for (var i = 0; i < csprojFiles.length; i++) {
    try {
      var content = fs.readFileSync(csprojFiles[i], 'utf8');
      // Extract PackageReference entries
      var pkgMatches = content.match(/<PackageReference\s+Include="([^"]+)"/g);
      if (pkgMatches) {
        for (var j = 0; j < pkgMatches.length; j++) {
          var m = pkgMatches[j].match(/Include="([^"]+)"/);
          if (m && result.packages.indexOf(m[1]) === -1) {
            result.packages.push(m[1]);
          }
        }
      }
    } catch (e) {
      // File unreadable — skip
    }
  }

  result.description = csprojFiles.length + ' .csproj file(s) changed — '
    + result.packages.length + ' package reference(s) found.';

  return result;
}

module.exports = {
  analyzeImpact,
  getMemoryImpact,
  getDtsImpact,
  getDependencyImpact,
};
