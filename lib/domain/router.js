/**
 * Domain Router Module
 * @module lib/domain/router
 * @version 0.1.0
 *
 * Routes templates, quality thresholds, and destructive patterns
 * based on detected domain (MCU/MPU/WPF).
 */

const path = require('path');

let _core = null;
function getCore() {
  if (!_core) { _core = require('../core'); }
  return _core;
}

let _detector = null;
function getDetector() {
  if (!_detector) { _detector = require('./detector'); }
  return _detector;
}

// ── Destructive Command Patterns ────────────────────────────────────

const MCU_DANGEROUS_PATTERNS = [
  { pattern: 'st-flash erase',                reason: 'STM32 전체 Flash 소거 (st-link)' },
  { pattern: 'st-flash --reset',              reason: 'STM32 리셋 동반 플래시' },
  { pattern: 'STM32_Programmer_CLI',          reason: 'CubeProgrammer CLI 실행' },
  { pattern: 'JLinkExe',                      reason: 'J-Link CLI 실행 (Linux/macOS)' },
  { pattern: 'JLink.exe',                     reason: 'J-Link CLI 실행 (Windows)' },
  { pattern: 'openocd.*flash erase',          reason: 'OpenOCD Flash 소거' },
  { pattern: 'openocd.*mass_erase',           reason: 'OpenOCD 대량 소거' },
  { pattern: 'nand erase',                    reason: 'NAND 전체 소거' },
];

const MPU_DANGEROUS_PATTERNS = [
  { pattern: 'dd if=.*of=/dev/sd',            reason: 'SD 카드 직접 쓰기' },
  { pattern: 'dd if=.*of=/dev/mmc',           reason: 'eMMC 직접 쓰기' },
  { pattern: 'mkfs',                          reason: '파일시스템 포맷' },
  { pattern: 'rm -rf /rootfs',               reason: '루트파일시스템 삭제' },
  { pattern: 'flashcp.*mtd',                  reason: 'MTD 파티션 덮어쓰기' },
];

const WPF_DANGEROUS_PATTERNS = [
  { pattern: 'dotnet publish.*--self-contained', reason: '자체 포함 배포 (크기 주의)' },
];

const COMMON_DANGEROUS_PATTERNS = [
  { pattern: 'rm -rf',                        reason: '재귀적 강제 삭제' },
  { pattern: 'git push --force',              reason: '강제 푸시' },
  { pattern: 'git reset --hard',              reason: '하드 리셋' },
];

// ── Build Command Patterns ──────────────────────────────────────────

const BUILD_COMMAND_PATTERNS = {
  mcu: ['make', 'cmake --build', 'ninja', 'arm-none-eabi-gcc'],
  mpu: ['bitbake', 'make', 'buildroot'],
  wpf: ['dotnet build', 'msbuild', 'dotnet publish'],
};

// ── Public API ──────────────────────────────────────────────────────

/**
 * Get templates for PDCA phase based on domain
 * @param {string} phase - 'plan' | 'design' | 'analysis' | 'report'
 * @returns {string[]} Template file paths (common + domain-specific)
 */
function getTemplatesForPhase(phase) {
  const { PLUGIN_ROOT } = getCore();
  const { domain } = getDetector().getCachedDomainInfo();
  const templatesDir = path.join(PLUGIN_ROOT, 'templates');

  const common = [path.join(templatesDir, `${phase}.template.md`)];

  const domainTemplates = {
    mcu: {
      plan: ['mcu-hw-spec.template.md', 'mcu-memory-budget.template.md'],
      design: ['mcu-driver-spec.template.md'],
    },
    mpu: {
      plan: ['mpu-bsp-spec.template.md'],
      design: ['mpu-dts-spec.template.md'],
    },
    wpf: {
      plan: ['wpf-ui-spec.template.md'],
      design: ['wpf-mvvm-spec.template.md'],
    },
  };

  const extra = (domainTemplates[domain] || {})[phase] || [];
  return [...common, ...extra.map(t => path.join(templatesDir, t))];
}

/**
 * Get quality gate thresholds for detected domain
 * @returns {Object}
 */
function getQualityThresholds() {
  const { getConfig } = getCore();
  const { domain } = getDetector().getCachedDomainInfo();

  const common = {
    matchRate: getConfig('quality.thresholds.matchRate', 90),
    codeQualityScore: getConfig('quality.thresholds.codeQualityScore', 70),
    conventionCompliance: getConfig('quality.thresholds.conventionCompliance', 90),
  };

  const domainThresholds = {
    mcu: {
      flashUsagePercent: getConfig('mcu.memoryBudget.flashWarningPercent', 85),
      ramUsagePercent: getConfig('mcu.memoryBudget.ramWarningPercent', 75),
      stackMarginPercent: getConfig('mcu.memoryBudget.stackMarginPercent', 20),
      misraRequired: getConfig('mcu.misra.requiredViolations', 0),
    },
    mpu: {
      imageMaxSizeMB: getConfig('mpu.imageLimits.rootfsMaxMB', 256),
      kernelSizeKB: getConfig('mpu.imageLimits.kernelMaxKB', 8192),
      bootTimeSeconds: getConfig('mpu.imageLimits.bootTimeMaxSeconds', 10),
    },
    wpf: {
      buildWarnings: getConfig('wpf.qualityChecks.buildWarnings', 0),
      bindingErrors: getConfig('wpf.qualityChecks.bindingErrors', 0),
    },
  };

  return { ...common, ...(domainThresholds[domain] || {}) };
}

/**
 * Get destructive command patterns for detected domain
 * @returns {Array<{pattern: string, reason: string}>}
 */
function getDestructivePatterns() {
  const { domain } = getDetector().getCachedDomainInfo();

  const domainPatterns = {
    mcu: MCU_DANGEROUS_PATTERNS,
    mpu: MPU_DANGEROUS_PATTERNS,
    wpf: WPF_DANGEROUS_PATTERNS,
  };

  return [...COMMON_DANGEROUS_PATTERNS, ...(domainPatterns[domain] || [])];
}

/**
 * Get build command patterns for detected domain
 * @returns {string[]}
 */
function getBuildPatterns() {
  const { domain } = getDetector().getCachedDomainInfo();
  return BUILD_COMMAND_PATTERNS[domain] || [];
}

/**
 * Route post-tool analysis based on domain
 * @param {string} toolName
 * @param {Object} input
 * @returns {Object|null}
 */
function routePostToolAnalysis(toolName, input) {
  const { domain } = getDetector().getCachedDomainInfo();

  if (toolName === 'Bash') {
    const patterns = getBuildPatterns();
    const command = (input && input.command) || '';
    const isBuild = patterns.some(p => command.includes(p));
    if (!isBuild) return null;

    return { domain, type: 'build-complete', command };
  }

  if (toolName === 'Write') {
    const filePath = (input && input.file_path) || '';
    const ext = path.extname(filePath).toLowerCase();

    if (domain === 'mpu' && ['.dts', '.dtsi'].includes(ext)) {
      return { domain, type: 'dts-modified', file: filePath };
    }
    if (domain === 'wpf' && ext === '.xaml') {
      return { domain, type: 'xaml-modified', file: filePath };
    }
  }

  return null;
}

/**
 * Get pipeline guide for detected domain
 * @returns {Object} Phase descriptions per domain
 */
function getPipelineGuide() {
  const { domain } = getDetector().getCachedDomainInfo();

  const guides = {
    mcu: {
      'Phase 1': 'HW 사양, 핀맵, 클럭, 메모리 예산',
      'Phase 2': 'MISRA C, 네이밍, 파일 구조',
      'Phase 3': '레이어 구조, 인터럽트 맵',
      'Phase 4': 'BSP 초기화, 스타트업 코드',
      'Phase 5': '디바이스 드라이버, HAL 래퍼',
      'Phase 6': '페리페럴 통합, RTOS 태스크',
      'Phase 7': 'Unit(Host), HIL, QEMU',
      'Phase 8': '메모리, 전력, 인터럽트 응답',
      'Phase 9': '플래싱, OTA, 양산 테스트',
    },
    mpu: {
      'Phase 1': 'SoC 선정, DT 설계, 이미지 구성',
      'Phase 2': '커널 코딩 스타일, DTS 컨벤션',
      'Phase 3': 'BSP 레이어, 디바이스 트리 구조',
      'Phase 4': '커널 설정, 루트파일시스템',
      'Phase 5': '커널 모듈, 사용자공간 데몬',
      'Phase 6': '앱↔커널 연동, D-Bus/IPC',
      'Phase 7': '커널 테스트, 통합 테스트',
      'Phase 8': '부팅 시간, 이미지 크기',
      'Phase 9': '이미지 빌드, OTA, 공장 초기화',
    },
    wpf: {
      'Phase 1': 'UI 와이어프레임, 화면 목록',
      'Phase 2': 'C# 코딩 컨벤션, XAML 규칙',
      'Phase 3': 'MVVM 구조, DI 컨테이너',
      'Phase 4': '프로젝트 셋업, NuGet, DI',
      'Phase 5': 'ViewModel, Model, Service',
      'Phase 6': 'View↔ViewModel 바인딩',
      'Phase 7': 'xUnit, UI 자동화 테스트',
      'Phase 8': '렌더링 성능, 메모리',
      'Phase 9': '설치 패키지, 자동 업데이트',
    },
  };

  return guides[domain] || guides.mcu;
}

module.exports = {
  MCU_DANGEROUS_PATTERNS,
  MPU_DANGEROUS_PATTERNS,
  WPF_DANGEROUS_PATTERNS,
  BUILD_COMMAND_PATTERNS,
  getTemplatesForPhase,
  getQualityThresholds,
  getDestructivePatterns,
  getBuildPatterns,
  routePostToolAnalysis,
  getPipelineGuide,
};
