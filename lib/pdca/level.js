/**
 * Level Detection Module (mcukit - Domain-aware)
 * @module lib/pdca/level
 * @version 0.1.0
 * @origin bkit v1.6.0 level.js - Rewritten for MCU/MPU/WPF domain levels
 */

const fs = require('fs');
const path = require('path');

// Lazy require to avoid circular dependency
let _core = null;
function getCore() {
  if (!_core) {
    _core = require('../core');
  }
  return _core;
}

/**
 * Level-Phase map for each project level
 * L1_Basic / L2_Standard / L3_Advanced
 */
const LEVEL_PHASE_MAP = {
  L1_Basic: {
    required: ['plan', 'do', 'check'],
    optional: ['design'],
    skip: [],
  },
  L2_Standard: {
    required: ['plan', 'design', 'do', 'check', 'report'],
    optional: [],
    skip: [],
  },
  L3_Advanced: {
    required: ['plan', 'design', 'do', 'check', 'act', 'report'],
    optional: [],
    skip: [],
  },
};

/**
 * MCU 레벨 마커
 */
const MCU_LEVEL_MARKERS = {
  L3_Advanced: ['*_core0*', '*_core1*', 'safety*', '*_cm4*', '*_cm7*'],
  L2_Standard: ['FreeRTOS*', 'cmsis_os*', 'FreeRTOSConfig.h', 'tasks.c'],
  L1_Basic: [],  // 기본값
};

/**
 * MPU 레벨 마커
 */
const MPU_LEVEL_MARKERS = {
  L3_Advanced: ['*gpu*', '*multimedia*', '*ota*', '*secure-boot*'],
  L2_Standard: ['local.conf', 'bblayers.conf', '*.bb'],
  L1_Basic: ['buildroot*', 'defconfig'],
};

/**
 * WPF 레벨 마커
 */
const WPF_LEVEL_MARKERS = {
  L3_Advanced: ['*Plugin*', '*Module*', 'Shell*', '*Prism*'],
  L2_Standard: ['*ViewModel*', '*Service*', 'App.xaml.cs'],
  L1_Basic: [],
};

/**
 * Detect project level based on domain and markers
 * @returns {'L1_Basic' | 'L2_Standard' | 'L3_Advanced'}
 */
function detectLevel() {
  const { PROJECT_DIR, getConfig, debugLog } = getCore();

  // Check environment variable override
  const envLevel = process.env.MCUKIT_LEVEL;
  if (envLevel && LEVEL_PHASE_MAP[envLevel]) {
    debugLog('Level', `Level from env: ${envLevel}`);
    return envLevel;
  }

  // Check config override
  const configLevel = getConfig('domain.levelOverride', null);
  if (configLevel && LEVEL_PHASE_MAP[configLevel]) {
    debugLog('Level', `Level from config: ${configLevel}`);
    return configLevel;
  }

  // Try to use cached domain info
  let domain = 'unknown';
  try {
    const domainModule = require('../domain/detector');
    const info = domainModule.getCachedDomainInfo();
    if (info && info.domain) {
      domain = info.domain;
      if (info.level) return info.level;
    }
  } catch (_) {
    // domain module not yet available during bootstrap
  }

  // Detect from markers
  const markers = getMarkersForDomain(domain);
  const detected = detectLevelFromMarkers(PROJECT_DIR, markers);

  debugLog('Level', `Detected level: ${detected} (domain: ${domain})`);
  return detected;
}

/**
 * Get level markers for a domain
 * @param {string} domain
 * @returns {Object}
 */
function getMarkersForDomain(domain) {
  switch (domain) {
    case 'mcu': return MCU_LEVEL_MARKERS;
    case 'mpu': return MPU_LEVEL_MARKERS;
    case 'wpf': return WPF_LEVEL_MARKERS;
    default: return MCU_LEVEL_MARKERS; // fallback
  }
}

/**
 * Detect level by scanning for marker patterns
 * @param {string} projectDir
 * @param {Object} markers
 * @returns {string}
 */
function detectLevelFromMarkers(projectDir, markers) {
  // Check highest level first
  for (const level of ['L3_Advanced', 'L2_Standard']) {
    const patterns = markers[level] || [];
    for (const pattern of patterns) {
      if (hasMatchingFile(projectDir, pattern)) {
        return level;
      }
    }
  }
  return 'L1_Basic';
}

/**
 * Check if any file matches a glob-like pattern (simple implementation)
 * @param {string} dir
 * @param {string} pattern
 * @returns {boolean}
 */
function hasMatchingFile(dir, pattern) {
  try {
    const cleanPattern = pattern.replace(/\*/g, '');
    const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: false });
    // Simple substring match (not full glob)
    return entries.some(entry => {
      const name = typeof entry === 'string' ? entry : entry.name || String(entry);
      return name.includes(cleanPattern);
    });
  } catch (_) {
    return false;
  }
}

/**
 * Check if a phase can be skipped at the given level
 */
function canSkipPhase(level, phase) {
  const map = LEVEL_PHASE_MAP[level];
  if (!map) return false;
  return (map.skip || []).includes(phase);
}

/**
 * Get required phases for level
 */
function getRequiredPhases(level) {
  const map = LEVEL_PHASE_MAP[level];
  return map ? map.required : ['plan', 'do', 'check'];
}

/**
 * Get next phase for level
 */
function getNextPhaseForLevel(currentPhase, level) {
  const phases = getRequiredPhases(level);
  const idx = phases.indexOf(currentPhase);
  if (idx < 0 || idx >= phases.length - 1) return null;
  return phases[idx + 1];
}

/**
 * Check if phase is applicable to level
 */
function isPhaseApplicable(phase, level) {
  const map = LEVEL_PHASE_MAP[level];
  if (!map) return true;
  return map.required.includes(phase) || (map.optional || []).includes(phase);
}

/**
 * Get level-phase guide text
 */
function getLevelPhaseGuide(level) {
  const map = LEVEL_PHASE_MAP[level];
  if (!map) return 'Unknown level';
  return `Required: ${map.required.join(' → ')}\nOptional: ${(map.optional || []).join(', ') || 'none'}`;
}

module.exports = {
  LEVEL_PHASE_MAP,
  MCU_LEVEL_MARKERS,
  MPU_LEVEL_MARKERS,
  WPF_LEVEL_MARKERS,
  detectLevel,
  canSkipPhase,
  getRequiredPhases,
  getNextPhaseForLevel,
  isPhaseApplicable,
  getLevelPhaseGuide,
};
