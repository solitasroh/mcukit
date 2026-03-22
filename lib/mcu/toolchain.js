/**
 * ARM Cross-Compiler & Build System Detection
 * @module lib/mcu/toolchain
 * @version 0.2.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Detect installed ARM cross-compiler
 * @returns {{ found: boolean, path: string|null, version: string|null, type: 'gcc'|'iar'|'keil'|null }}
 */
function detectToolchain() {
  // 1. Config override
  try {
    const core = require('../core');
    const configPath = core.getConfig('mcu.toolchain', null);
    if (configPath && fs.existsSync(configPath)) {
      const version = getGccVersion(configPath);
      return { found: true, path: configPath, version, type: 'gcc' };
    }
  } catch (_) {}

  // 2. Environment variables
  for (const envVar of ['ARM_GCC_PATH', 'ARMGCC_DIR']) {
    const envPath = process.env[envVar];
    if (envPath) {
      const gccPath = findGccInDir(envPath);
      if (gccPath) {
        return { found: true, path: gccPath, version: getGccVersion(gccPath), type: 'gcc' };
      }
    }
  }

  // 3. PATH search
  const whichCmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const result = execSync(`${whichCmd} arm-none-eabi-gcc`, { encoding: 'utf-8', timeout: 5000 }).trim();
    const gccPath = result.split('\n')[0].trim();
    if (gccPath && fs.existsSync(gccPath)) {
      return { found: true, path: gccPath, version: getGccVersion(gccPath), type: 'gcc' };
    }
  } catch (_) {}

  // 4. Default install paths
  const defaultPaths = getDefaultPaths();
  for (const dir of defaultPaths) {
    const gccPath = findGccInDir(dir);
    if (gccPath) {
      return { found: true, path: gccPath, version: getGccVersion(gccPath), type: 'gcc' };
    }
  }

  return { found: false, path: null, version: null, type: null };
}

/**
 * Detect build system type
 * @returns {{ type: 'cmake'|'makefile'|'keil'|'iar'|'unknown', configFile: string|null }}
 */
function detectBuildSystem() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // CMake
  const cmakePath = path.join(projectDir, 'CMakeLists.txt');
  if (fs.existsSync(cmakePath)) {
    return { type: 'cmake', configFile: cmakePath };
  }

  // Makefile
  const makefilePath = path.join(projectDir, 'Makefile');
  if (fs.existsSync(makefilePath)) {
    return { type: 'makefile', configFile: makefilePath };
  }

  // Keil uVision
  try {
    const files = fs.readdirSync(projectDir);
    const keilFile = files.find(f => f.endsWith('.uvprojx') || f.endsWith('.uvproj'));
    if (keilFile) {
      return { type: 'keil', configFile: path.join(projectDir, keilFile) };
    }

    // IAR
    const iarFile = files.find(f => f.endsWith('.ewp'));
    if (iarFile) {
      return { type: 'iar', configFile: path.join(projectDir, iarFile) };
    }
  } catch (_) {}

  return { type: 'unknown', configFile: null };
}

/**
 * Run arm-none-eabi-size on an ELF file
 * @param {string} elfPath
 * @returns {{ text: number, data: number, bss: number, total: number }|null}
 */
function runArmSize(elfPath) {
  if (!elfPath || !fs.existsSync(elfPath)) return null;

  try {
    const output = execSync(`arm-none-eabi-size "${elfPath}"`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return parseSizeOutput(output);
  } catch (_) {
    return null;
  }
}

/**
 * Parse arm-none-eabi-size output
 * @param {string} output
 * @returns {{ text: number, data: number, bss: number, total: number }|null}
 */
function parseSizeOutput(output) {
  const lines = output.trim().split('\n');
  if (lines.length < 2) return null;

  const dataLine = lines[1].trim();
  const parts = dataLine.split(/\s+/);
  if (parts.length < 3) return null;

  const text = parseInt(parts[0], 10);
  const data = parseInt(parts[1], 10);
  const bss = parseInt(parts[2], 10);

  return { text, data, bss, total: text + data + bss };
}

// ── Helpers ──

function getDefaultPaths() {
  if (process.platform === 'win32') {
    return [
      'C:/ST/STM32CubeIDE',
      'C:/Program Files (x86)/GNU Arm Embedded Toolchain',
      'C:/Program Files/GNU Arm Embedded Toolchain',
      'C:/NXP/MCUXpressoIDE',
    ];
  }
  return [
    '/usr/bin',
    '/usr/local/bin',
    '/opt/gcc-arm-none-eabi',
    '/opt/st/stm32cubeide',
  ];
}

function findGccInDir(dir) {
  const gccName = process.platform === 'win32' ? 'arm-none-eabi-gcc.exe' : 'arm-none-eabi-gcc';

  // Direct check
  const direct = path.join(dir, gccName);
  if (fs.existsSync(direct)) return direct;

  // Check bin/ subdirectory
  const inBin = path.join(dir, 'bin', gccName);
  if (fs.existsSync(inBin)) return inBin;

  // Recursive search (1 level deep for version dirs)
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subBin = path.join(dir, entry.name, 'bin', gccName);
        if (fs.existsSync(subBin)) return subBin;
      }
    }
  } catch (_) {}

  return null;
}

function getGccVersion(gccPath) {
  try {
    const output = execSync(`"${gccPath}" --version`, { encoding: 'utf-8', timeout: 5000 });
    const match = output.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch (_) {
    return null;
  }
}

module.exports = {
  detectToolchain,
  detectBuildSystem,
  runArmSize,
  parseSizeOutput,
};
