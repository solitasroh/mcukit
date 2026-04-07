/**
 * Domain Auto-Detection Module
 * @module lib/domain/detector
 * @version 0.1.0
 *
 * Scans project directory for marker files to detect domain (MCU/MPU/WPF)
 * and sub-platform (STM32, NXP K, i.MX6, i.MX6ULL, i.MX28, WPF .NET8/.NET FW).
 */

const fs = require('fs');
const path = require('path');

// Direct require (circular dependency removed in Phase 3)
const core = require('../core');
function getCore() {
  return core;
}

// ── Domain Marker Definitions ──────────────────────────────────────

/**
 * MCU domain markers
 * .ioc = CubeMX project (Java Properties format)
 * .ld  = GNU linker script
 * startup_*.s = ARM startup assembly
 * stm32*.h / fsl_*.h = vendor HAL headers
 */
const MCU_MARKERS = {
  files: [
    '*.ioc',                    // STM32 CubeMX project
    '*.ld',                     // GNU linker script
    'startup_*.s',              // ARM startup assembly
    'stm32*.h',                 // STM32 HAL headers
    'fsl_*.h',                  // NXP MCUXpresso SDK headers
    'fsl_device_registers.h',   // NXP device register header (NOT sdk_config.h)
    'board.h',                  // NXP MCUXpresso board header
    'FreeRTOSConfig.h',         // FreeRTOS config
  ],
  content: ['HAL_Init', 'NVIC_', 'arm-none-eabi', 'Cortex-M'],
};

/**
 * MPU domain markers (i.MX Embedded Linux)
 * .dts/.dtsi = Device Tree Source
 * local.conf / bblayers.conf = Yocto build config (in build/conf/)
 * *.bb / *.bbappend = Yocto recipes
 */
const MPU_MARKERS = {
  files: [
    '*.dts',                    // Device Tree Source
    '*.dtsi',                   // Device Tree Include
    'local.conf',               // Yocto local config (build/conf/)
    'bblayers.conf',            // Yocto layers config
    '*.bb',                     // Yocto recipe
    '*.bbappend',               // Yocto recipe append
    'defconfig',                // Buildroot/Kernel defconfig
  ],
  content: ['imx6', 'imx6ull', 'imx28', 'stm32mp', 'ARCH=arm', 'device-tree', 'yocto', 'buildroot'],
};

/**
 * WPF domain markers
 * .csproj with <UseWPF>true</UseWPF> = .NET 8 WPF
 * PresentationFramework reference = .NET Framework WPF
 * App.xaml = WPF application entry (strong hint, not mandatory)
 */
const WPF_MARKERS = {
  files: [
    '*.csproj',                 // C# project (needs content check for UseWPF)
    'App.xaml',                 // WPF app entry (strong hint, not mandatory)
    '*.sln',                    // Visual Studio solution
    '*.xaml',                   // XAML files
  ],
  content: ['<UseWPF>true</UseWPF>', 'PresentationFramework', 'System.Windows'],
};

// ── Cache ───────────────────────────────────────────────────────────

let _cachedResult = null;

// ── Public API ──────────────────────────────────────────────────────

/**
 * Detect project domain
 * @returns {{ domain: 'mcu'|'mpu'|'wpf'|'unknown', confidence: number, markers: string[] }}
 */
function detectDomain() {
  const { PROJECT_DIR, getConfig, debugLog } = getCore();

  // 1. Config override
  const override = getConfig('domain.override', null);
  if (override) {
    const result = { domain: override, confidence: 1.0, markers: ['config.override'] };
    _cachedResult = result;
    return result;
  }

  // 2. Scan for markers
  const mcuScore = scanMarkers(PROJECT_DIR, MCU_MARKERS);
  const mpuScore = scanMarkers(PROJECT_DIR, MPU_MARKERS);
  const wpfScore = scanForWpf(PROJECT_DIR);

  debugLog('DomainDetect', 'Scores', { mcu: mcuScore.score, mpu: mpuScore.score, wpf: wpfScore.score });

  // 3. Select highest
  const scores = [
    { domain: 'mcu', ...mcuScore },
    { domain: 'mpu', ...mpuScore },
    { domain: 'wpf', ...wpfScore },
  ].sort((a, b) => b.score - a.score);

  if (scores[0].score === 0) {
    const result = { domain: 'unknown', confidence: 0, markers: [] };
    _cachedResult = result;
    return result;
  }

  const maxScore = scores[0].score;
  const confidence = Math.min(1.0, maxScore / 5);

  const result = {
    domain: scores[0].domain,
    confidence,
    markers: scores[0].matched,
    secondary: scores[1].score > 0 ? scores[1].domain : null,
  };

  _cachedResult = result;
  return result;
}

/**
 * Detect level within domain
 * @param {'mcu'|'mpu'|'wpf'} domain
 * @returns {{ level: 'L1_Basic'|'L2_Standard'|'L3_Advanced', markers: string[] }}
 */
function detectDomainLevel(domain) {
  try {
    const levelModule = require('../pdca/level');
    const level = levelModule.detectLevel();
    const markers = levelModule.getMarkersForDomain
      ? Object.values(levelModule[`${(domain || '').toUpperCase()}_LEVEL_MARKERS`] || {})
          .flat().filter(Boolean)
      : [];
    return {
      level: level || 'L1_Basic',
      markers: markers,
    };
  } catch (e) {
    getCore().debugLog('DomainDetect', 'Level detection fallback to L1_Basic', { domain, error: e.message });
    return { level: 'L1_Basic', markers: [] };
  }
}

/**
 * Detect sub-platform within domain
 * @param {'mcu'|'mpu'|'wpf'} domain
 * @returns {{ platform: string, sdk: string, chip: string|null }}
 */
function detectPlatform(domain) {
  const { PROJECT_DIR } = getCore();

  switch (domain) {
    case 'mcu': return detectMcuPlatform(PROJECT_DIR);
    case 'mpu': return detectMpuPlatform(PROJECT_DIR);
    case 'wpf': return detectWpfPlatform(PROJECT_DIR);
    default: return { platform: 'unknown', sdk: 'unknown', chip: null };
  }
}

/**
 * Get cached domain detection result (for use after SessionStart)
 * @returns {{ domain: string, confidence: number, markers: string[], level: string, platform: Object }|null}
 */
function getCachedDomainInfo() {
  if (_cachedResult) return _cachedResult;

  // Try loading from domain-cache.json
  try {
    const { PROJECT_DIR } = getCore();
    const cachePath = path.join(PROJECT_DIR, '.rkit', 'state', 'domain-cache.json');
    if (fs.existsSync(cachePath)) {
      _cachedResult = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      return _cachedResult;
    }
  } catch (e) {
    getCore().debugLog('DomainDetect', 'Domain cache read failed', { error: e.message });
  }

  return { domain: 'unknown', confidence: 0, markers: [] };
}

/**
 * Save domain cache to file
 * @param {Object} result
 */
function saveDomainCache(result) {
  try {
    const { PROJECT_DIR } = getCore();
    const stateDir = path.join(PROJECT_DIR, '.rkit', 'state');
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    const cachePath = path.join(stateDir, 'domain-cache.json');
    fs.writeFileSync(cachePath, JSON.stringify({
      ...result,
      detectedAt: new Date().toISOString(),
    }, null, 2));
  } catch (e) {
    getCore().debugLog('DomainDetect', 'Domain cache write failed', { error: e.message });
  }
}

// ── Private Helpers ─────────────────────────────────────────────────

/**
 * Scan directory for marker patterns and return score
 */
function scanMarkers(projectDir, markerDef) {
  let score = 0;
  const matched = [];

  for (const pattern of markerDef.files) {
    if (hasFilePattern(projectDir, pattern)) {
      score++;
      matched.push(pattern);
    }
  }

  return { score, matched };
}

/**
 * Special WPF detection: .csproj must contain <UseWPF>true or PresentationFramework
 */
function scanForWpf(projectDir) {
  let score = 0;
  const matched = [];

  // Find .csproj files and check content
  const csprojFiles = findFiles(projectDir, '.csproj', 3);
  for (const f of csprojFiles) {
    try {
      const content = fs.readFileSync(f, 'utf-8');
      if (content.includes('<UseWPF>true</UseWPF>') || content.includes('<UseWPF>True</UseWPF>')) {
        score += 3; // Strong signal
        matched.push(`${path.basename(f)} [UseWPF]`);
      } else if (content.includes('PresentationFramework')) {
        score += 3; // .NET Framework WPF
        matched.push(`${path.basename(f)} [PresentationFramework]`);
      }
    } catch (e) {
      getCore().debugLog('DomainDetect', 'csproj read failed', { file: path.basename(f), error: e.message });
    }
  }

  // App.xaml is a strong hint
  if (hasFilePattern(projectDir, 'App.xaml')) {
    score++;
    matched.push('App.xaml');
  }

  // .xaml files
  const xamlFiles = findFiles(projectDir, '.xaml', 3);
  if (xamlFiles.length > 1) {
    score++;
    matched.push(`${xamlFiles.length} .xaml files`);
  }

  return { score, matched };
}

/**
 * Check if a file matching a simple glob pattern exists
 */
function hasFilePattern(dir, pattern) {
  try {
    const files = scanDir(dir, 3);
    const regex = globToRegex(pattern);
    return files.some(f => regex.test(path.basename(f)));
  } catch (e) {
    getCore().debugLog('DomainDetect', 'File pattern scan failed', { dir, pattern, error: e.message });
    return false;
  }
}

/**
 * Find files with specific extension
 */
function findFiles(dir, ext, maxDepth) {
  try {
    return scanDir(dir, maxDepth).filter(f => f.endsWith(ext));
  } catch (e) {
    getCore().debugLog('DomainDetect', 'File find failed', { dir, ext, error: e.message });
    return [];
  }
}

/**
 * Recursively scan directory (with depth limit and caching)
 */
const _scanCache = new Map();
const _scanCacheTimestamps = new Map();
const SCAN_CACHE_TTL = 60000;  // 60 seconds
const SCAN_CACHE_MAX = 20;     // max entries
const SCAN_EXCLUDES = [
  '.git', 'node_modules', 'build', 'output', 'bin', 'obj',
  '.rkit', 'sysroots', 'tmp', 'packages', '.vs', 'Debug',
  'Release', 'dist', 'target', '.cache', 'downloads', 'sstate-cache',
];

/**
 * Clear scan cache (for testing and session refresh)
 */
function clearScanCache() {
  _scanCache.clear();
  _scanCacheTimestamps.clear();
}

function scanDir(dir, maxDepth, currentDepth = 0) {
  if (currentDepth >= maxDepth) return [];

  const cacheKey = `${dir}:${maxDepth}`;
  if (currentDepth === 0 && _scanCache.has(cacheKey)) {
    // TTL check
    const age = Date.now() - (_scanCacheTimestamps.get(cacheKey) || 0);
    if (age < SCAN_CACHE_TTL) {
      return _scanCache.get(cacheKey);
    }
    // Expired — remove
    _scanCache.delete(cacheKey);
    _scanCacheTimestamps.delete(cacheKey);
  }

  const results = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SCAN_EXCLUDES.includes(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        results.push(fullPath);
      } else if (entry.isDirectory() && currentDepth < maxDepth - 1) {
        results.push(...scanDir(fullPath, maxDepth, currentDepth + 1));
      }
    }
  } catch (e) {
    getCore().debugLog('DomainDetect', 'Directory scan failed', { dir, error: e.message });
  }

  if (currentDepth === 0) {
    // LRU eviction when cache is full
    if (_scanCache.size >= SCAN_CACHE_MAX) {
      const oldest = _scanCache.keys().next().value;
      _scanCache.delete(oldest);
      _scanCacheTimestamps.delete(oldest);
    }
    _scanCache.set(cacheKey, results);
    _scanCacheTimestamps.set(cacheKey, Date.now());
  }
  return results;
}

/**
 * Convert simple glob pattern to regex
 * Supports: * (any chars), ? (single char)
 */
function globToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

// ── Platform Detection ──────────────────────────────────────────────

function detectMcuPlatform(projectDir) {
  const files = scanDir(projectDir, 3);
  const fileNames = files.map(f => path.basename(f).toLowerCase());

  // STM32 detection
  if (fileNames.some(f => f.endsWith('.ioc') || f.startsWith('stm32'))) {
    // Try to extract chip name from .ioc file
    const iocFile = files.find(f => f.endsWith('.ioc'));
    let chip = null;
    if (iocFile) {
      try {
        const content = fs.readFileSync(iocFile, 'utf-8');
        const match = content.match(/Mcu\.UserName=(STM32\w+)/i);
        if (match) chip = match[1];
      } catch (e) {
        getCore().debugLog('DomainDetect', 'IOC file read failed', { file: iocFile, error: e.message });
      }
    }
    return { platform: 'stm32', sdk: 'STM32Cube', chip };
  }

  // NXP Kinetis detection
  if (fileNames.some(f => f.startsWith('fsl_') || f === 'board.h')) {
    return { platform: 'nxp-k', sdk: 'MCUXpresso', chip: null };
  }

  return { platform: 'unknown-mcu', sdk: 'unknown', chip: null };
}

function detectMpuPlatform(projectDir) {
  const files = scanDir(projectDir, 4);

  // Check DTS filenames and content for platform variant
  const dtsFiles = files.filter(f => f.endsWith('.dts') || f.endsWith('.dtsi'));
  const dtsNames = dtsFiles.map(f => path.basename(f).toLowerCase());

  // STM32MP detection (DTS filenames or content patterns)
  if (dtsNames.some(n => n.includes('stm32mp'))) {
    return { platform: 'stm32mp', sdk: 'yocto', chip: 'STM32MP' };
  }
  // Check DTS/recipe content for STM32MP markers
  const stm32mpContentFiles = files.filter(f =>
    f.endsWith('.dts') || f.endsWith('.dtsi') || f.endsWith('.bb') || f.endsWith('.bbappend') || f.endsWith('.conf')
  );
  for (const f of stm32mpContentFiles) {
    try {
      const content = fs.readFileSync(f, 'utf-8');
      if (/stm32mp|tf-a-stm32mp|optee-os-stm32mp|STM32_PINMUX|st,stpmic/i.test(content)) {
        return { platform: 'stm32mp', sdk: 'yocto', chip: 'STM32MP' };
      }
    } catch (_) {}
  }

  // i.MX6 detection
  if (dtsNames.some(n => n.includes('imx6q') || n.includes('imx6dl'))) {
    return { platform: 'imx6', sdk: 'yocto', chip: 'i.MX6Q/DL' };
  }
  if (dtsNames.some(n => n.includes('imx6ull') || n.includes('imx6ul'))) {
    return { platform: 'imx6ull', sdk: 'yocto', chip: 'i.MX6ULL' };
  }
  if (dtsNames.some(n => n.includes('imx28'))) {
    // i.MX28: ARM926EJ-S, use soft float toolchain
    return { platform: 'imx28', sdk: 'buildroot', chip: 'i.MX28' };
  }

  // Check Yocto local.conf for MACHINE
  const localConf = files.find(f => f.endsWith('local.conf'));
  if (localConf) {
    try {
      const content = fs.readFileSync(localConf, 'utf-8');
      if (/stm32mp/i.test(content)) {
        return { platform: 'stm32mp', sdk: 'yocto', chip: 'STM32MP' };
      }
      if (content.includes('imx6qsabresd') || content.includes('imx6dlsabresd')) {
        return { platform: 'imx6', sdk: 'yocto', chip: 'i.MX6' };
      }
      if (content.includes('imx6ull')) {
        return { platform: 'imx6ull', sdk: 'yocto', chip: 'i.MX6ULL' };
      }
    } catch (e) {
      getCore().debugLog('DomainDetect', 'local.conf read failed', { file: localConf, error: e.message });
    }
  }

  return { platform: 'unknown-mpu', sdk: 'unknown', chip: null };
}

function detectWpfPlatform(projectDir) {
  const csprojFiles = findFiles(projectDir, '.csproj', 3);

  for (const f of csprojFiles) {
    try {
      const content = fs.readFileSync(f, 'utf-8');

      // .NET 8+ (SDK-style)
      const tfmMatch = content.match(/<TargetFramework>(net\d+\.\d+-windows)<\/TargetFramework>/);
      if (tfmMatch) {
        return { platform: `wpf-${tfmMatch[1]}`, sdk: `.NET ${tfmMatch[1]}`, chip: null };
      }

      // .NET Framework (legacy)
      if (content.includes('PresentationFramework')) {
        const fwMatch = content.match(/<TargetFrameworkVersion>v([\d.]+)<\/TargetFrameworkVersion>/);
        const version = fwMatch ? fwMatch[1] : '4.8';
        return { platform: `wpf-netfx${version}`, sdk: `.NET Framework ${version}`, chip: null };
      }
    } catch (e) {
      getCore().debugLog('DomainDetect', 'WPF csproj parse failed', { file: path.basename(f), error: e.message });
    }
  }

  return { platform: 'wpf-unknown', sdk: 'unknown', chip: null };
}

module.exports = {
  MCU_MARKERS,
  MPU_MARKERS,
  WPF_MARKERS,
  detectDomain,
  detectDomainLevel,
  detectPlatform,
  getCachedDomainInfo,
  saveDomainCache,
  clearScanCache,
};
