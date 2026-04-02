/**
 * File Type Detection (mcukit - Embedded/Desktop adapted)
 * @module lib/core/file
 * @version 0.1.0
 * @origin mcukit v1.6.0 file.js - TIER_EXTENSIONS redesigned for MCU/MPU/WPF
 */

const path = require('path');

// Lazy require to avoid circular dependency
let _config = null;
function getConfigModule() {
  if (!_config) {
    _config = require('./config');
  }
  return _config;
}

/**
 * Tier별 확장자 매핑 (임베디드/데스크톱 중심)
 */
const TIER_EXTENSIONS = {
  1: ['.c', '.h', '.cpp', '.hpp', '.cs'],                       // MCU C/C++, WPF C#
  2: ['.dts', '.dtsi', '.bb', '.bbappend', '.xaml', '.csproj'],  // MPU DTS/Yocto, WPF XAML
  3: ['.ld', '.s', '.S', '.icf', '.sln', '.resx'],              // 링커/스타트업, VS 솔루션
  4: ['.sh', '.bash', '.ps1', '.bat', '.cmd', '.cfg'],           // 스크립트/설정
};

/**
 * 도메인별 확장자 (도메인 감지 및 라우팅에 사용)
 */
const DOMAIN_EXTENSIONS = {
  mcu: ['.ioc', '.ld', '.s', '.S', '.cfg', '.map'],
  mpu: ['.dts', '.dtsi', '.bb', '.bbappend', '.conf', '.its'],
  wpf: ['.xaml', '.csproj', '.sln', '.resx', '.settings'],
};

/**
 * 기본 제외 패턴
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  '.git', 'build', 'output', 'bin', 'obj',
  'tmp', 'deploy', 'sysroots', 'node_modules',
  '__pycache__', '.cache', 'Debug', 'Release',
  'dist', 'target', 'coverage',
];

/**
 * 기본 Feature 패턴
 */
const DEFAULT_FEATURE_PATTERNS = [
  'drivers', 'peripherals', 'hal', 'modules',
  'kernel', 'recipes', 'layers',
  'ViewModels', 'Views', 'Services', 'Models',
  'features', 'packages', 'apps', 'services', 'domains',
];

/**
 * 소스 파일 여부
 * @param {string} filePath
 * @returns {boolean}
 */
function isSourceFile(filePath) {
  const { getConfig } = getConfigModule();
  const ext = path.extname(filePath).toLowerCase();
  const allExts = [
    ...TIER_EXTENSIONS[1],
    ...TIER_EXTENSIONS[2],
    ...TIER_EXTENSIONS[3],
    ...TIER_EXTENSIONS[4],
  ];

  const customExts = getConfig('fileDetection.sourceExtensions', []);
  const excludePatterns = getConfig('fileDetection.excludePatterns', DEFAULT_EXCLUDE_PATTERNS);

  for (const pattern of excludePatterns) {
    if (filePath.includes(pattern)) return false;
  }

  return allExts.includes(ext) || customExts.includes(ext);
}

/**
 * 코드 파일 여부 (임베디드/데스크톱 중심)
 * @param {string} filePath
 * @returns {boolean}
 */
function isCodeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const codeExts = ['.c', '.h', '.cpp', '.hpp', '.cs', '.dts', '.dtsi'];
  return codeExts.includes(ext);
}

/**
 * UI 컴포넌트 파일 여부 (WPF XAML)
 * @param {string} filePath
 * @returns {boolean}
 */
function isUiFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const uiExts = ['.xaml'];
  return uiExts.includes(ext) ||
    filePath.includes('/Views/') ||
    filePath.includes('\\Views\\');
}

/**
 * 환경설정 파일 여부
 * @param {string} filePath
 * @returns {boolean}
 */
function isEnvFile(filePath) {
  const basename = path.basename(filePath);
  return basename.startsWith('.env') ||
    basename.endsWith('.env') ||
    basename === 'local.conf' ||
    basename === 'App.config' ||
    basename === 'appsettings.json';
}

/**
 * 파일 경로에서 Feature 이름 추출
 * @param {string} filePath
 * @returns {string}
 */
function extractFeature(filePath) {
  if (!filePath) return '';

  const { getConfig } = getConfigModule();
  const featurePatterns = getConfig('featurePatterns', DEFAULT_FEATURE_PATTERNS);
  const genericNames = [
    'src', 'lib', 'app', 'Core', 'Src', 'Inc',
    'source', 'board', 'device', 'CMSIS',
    'common', 'shared', 'internal', 'utils',
  ];

  for (const pattern of featurePatterns) {
    const regex = new RegExp(`${pattern}[/\\\\]([^/\\\\]+)`);
    const match = filePath.match(regex);
    if (match && match[1] && !genericNames.includes(match[1])) {
      return match[1];
    }
  }

  const parts = filePath.split(/[/\\]/).filter(Boolean);
  for (let i = parts.length - 2; i >= 0; i--) {
    if (!genericNames.includes(parts[i])) {
      return parts[i];
    }
  }

  return '';
}

module.exports = {
  TIER_EXTENSIONS,
  DOMAIN_EXTENSIONS,
  DEFAULT_EXCLUDE_PATTERNS,
  DEFAULT_FEATURE_PATTERNS,
  isSourceFile,
  isCodeFile,
  isUiFile,
  isEnvFile,
  extractFeature,
};
