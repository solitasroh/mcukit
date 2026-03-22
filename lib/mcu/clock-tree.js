/**
 * CubeMX .ioc Clock Tree Parser & Validator
 * @module lib/mcu/clock-tree
 * @version 0.2.0
 *
 * Parses RCC.* keys from .ioc file (Java Properties format)
 * and calculates actual clock frequencies.
 *
 * Clock calculation (STM32F4 HSE+PLL):
 *   PLL_VCO = (HSE / PLLM) * PLLN
 *   SYSCLK  = PLL_VCO / PLLP
 *   AHB     = SYSCLK / AHBDiv
 *   APB1    = AHB / APB1Div
 *   APB2    = AHB / APB2Div
 */

/**
 * Extract clock configuration from .ioc data
 * @param {Map<string, string>} iocData - parseIocFile result
 * @returns {Object} Clock configuration with calculated frequencies
 */
function extractClockConfig(iocData) {
  const hseEnabled = iocData.get('RCC.HSEState') === 'RCC_HSE_ON';
  const hseFreq = parseInt(iocData.get('RCC.HSE_VALUE') || '8000000', 10);
  const hsiFreq = 16000000; // HSI is always 16 MHz on STM32F4

  // PLL configuration
  const pllSource = iocData.get('RCC.PLLSource') || 'RCC_PLLSOURCE_HSI';
  const pllM = parseInt(iocData.get('RCC.PLLM') || '8', 10);
  const pllN = parseInt(iocData.get('RCC.PLLN') || '336', 10);
  const pllPRaw = iocData.get('RCC.PLLP') || 'RCC_PLLP_DIV2';
  const pllP = parseDivider(pllPRaw, 'RCC_PLLP_DIV');
  const pllQ = parseInt(iocData.get('RCC.PLLQ') || '7', 10);

  // SYSCLK source
  const sysclkSource = iocData.get('RCC.SYSCLKSource') || 'RCC_SYSCLKSOURCE_HSI';

  // Bus dividers
  const ahbDivRaw = iocData.get('RCC.AHBCLKDivider') || 'RCC_SYSCLK_DIV1';
  const ahbDiv = parseDivider(ahbDivRaw, 'RCC_SYSCLK_DIV');
  const apb1DivRaw = iocData.get('RCC.APB1CLKDivider') || 'RCC_HCLK_DIV1';
  const apb1Div = parseDivider(apb1DivRaw, 'RCC_HCLK_DIV');
  const apb2DivRaw = iocData.get('RCC.APB2CLKDivider') || 'RCC_HCLK_DIV1';
  const apb2Div = parseDivider(apb2DivRaw, 'RCC_HCLK_DIV');

  // Calculate frequencies
  const pllInputFreq = pllSource.includes('HSE') ? hseFreq : hsiFreq;
  const pllVco = (pllInputFreq / pllM) * pllN;
  const pllOutput = pllVco / pllP;

  let sysclkFreq;
  if (sysclkSource.includes('PLLCLK')) {
    sysclkFreq = pllOutput;
  } else if (sysclkSource.includes('HSE')) {
    sysclkFreq = hseFreq;
  } else {
    sysclkFreq = hsiFreq;
  }

  const ahbFreq = sysclkFreq / ahbDiv;
  const apb1Freq = ahbFreq / apb1Div;
  const apb2Freq = ahbFreq / apb2Div;

  return {
    hse: { enabled: hseEnabled, frequency: hseFreq },
    hsi: { enabled: true, frequency: hsiFreq },
    pll: {
      source: pllSource.includes('HSE') ? 'HSE' : 'HSI',
      m: pllM, n: pllN, p: pllP, q: pllQ,
      vco: pllVco,
      output: pllOutput,
    },
    sysclk: {
      source: sysclkSource.includes('PLLCLK') ? 'PLL' :
              sysclkSource.includes('HSE') ? 'HSE' : 'HSI',
      frequency: sysclkFreq,
    },
    ahb: { divider: ahbDiv, frequency: ahbFreq },
    apb1: { divider: apb1Div, frequency: apb1Freq, maxFrequency: 42000000 },
    apb2: { divider: apb2Div, frequency: apb2Freq, maxFrequency: 84000000 },
  };
}

/**
 * Validate clock limits (STM32F4 specific)
 * @param {Object} clockConfig - extractClockConfig result
 * @returns {{ valid: boolean, issues: string[] }}
 */
function validateClockLimits(clockConfig) {
  const issues = [];

  // STM32F407 limits
  const SYSCLK_MAX = 168000000; // 168 MHz
  const APB1_MAX = 42000000;    // 42 MHz
  const APB2_MAX = 84000000;    // 84 MHz
  const PLL_VCO_MIN = 100000000;
  const PLL_VCO_MAX = 432000000;
  const PLL_INPUT_MIN = 1000000;  // 1 MHz
  const PLL_INPUT_MAX = 2000000;  // 2 MHz

  if (clockConfig.sysclk.frequency > SYSCLK_MAX) {
    issues.push(`SYSCLK ${formatFreq(clockConfig.sysclk.frequency)} exceeds max ${formatFreq(SYSCLK_MAX)}`);
  }

  if (clockConfig.apb1.frequency > APB1_MAX) {
    issues.push(`APB1 ${formatFreq(clockConfig.apb1.frequency)} exceeds max ${formatFreq(APB1_MAX)}`);
  }

  if (clockConfig.apb2.frequency > APB2_MAX) {
    issues.push(`APB2 ${formatFreq(clockConfig.apb2.frequency)} exceeds max ${formatFreq(APB2_MAX)}`);
  }

  if (clockConfig.pll.vco < PLL_VCO_MIN || clockConfig.pll.vco > PLL_VCO_MAX) {
    issues.push(`PLL VCO ${formatFreq(clockConfig.pll.vco)} out of range [${formatFreq(PLL_VCO_MIN)}-${formatFreq(PLL_VCO_MAX)}]`);
  }

  const pllInput = clockConfig.hse.enabled ? clockConfig.hse.frequency : clockConfig.hsi.frequency;
  const pllInputActual = pllInput / clockConfig.pll.m;
  if (pllInputActual < PLL_INPUT_MIN || pllInputActual > PLL_INPUT_MAX) {
    issues.push(`PLL input ${formatFreq(pllInputActual)} out of range [${formatFreq(PLL_INPUT_MIN)}-${formatFreq(PLL_INPUT_MAX)}]`);
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Format clock tree report
 * @param {Object} clockConfig
 * @returns {string}
 */
function formatClockReport(clockConfig) {
  const validation = validateClockLimits(clockConfig);

  let report = 'Clock Tree Configuration:\n';
  report += `  Source:  ${clockConfig.pll.source} (${formatFreq(clockConfig.hse.enabled ? clockConfig.hse.frequency : clockConfig.hsi.frequency)})\n`;
  report += `  PLL:    M=${clockConfig.pll.m}, N=${clockConfig.pll.n}, P=${clockConfig.pll.p}, Q=${clockConfig.pll.q}\n`;
  report += `  VCO:    ${formatFreq(clockConfig.pll.vco)}\n`;
  report += `  SYSCLK: ${formatFreq(clockConfig.sysclk.frequency)} (via ${clockConfig.sysclk.source})\n`;
  report += `  AHB:    ${formatFreq(clockConfig.ahb.frequency)} (/${clockConfig.ahb.divider})\n`;
  report += `  APB1:   ${formatFreq(clockConfig.apb1.frequency)} (/${clockConfig.apb1.divider}, max ${formatFreq(clockConfig.apb1.maxFrequency)})\n`;
  report += `  APB2:   ${formatFreq(clockConfig.apb2.frequency)} (/${clockConfig.apb2.divider}, max ${formatFreq(clockConfig.apb2.maxFrequency)})\n`;

  if (!validation.valid) {
    report += '\n  Issues:\n';
    for (const issue of validation.issues) {
      report += `    - ${issue}\n`;
    }
  }

  return report;
}

// ── Helpers ──

function parseDivider(raw, prefix) {
  if (!raw) return 1;
  const match = raw.match(new RegExp(`${prefix}(\\d+)`));
  return match ? parseInt(match[1], 10) : 1;
}

function formatFreq(hz) {
  if (hz >= 1000000) return `${(hz / 1000000).toFixed(1)} MHz`;
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)} kHz`;
  return `${hz} Hz`;
}

module.exports = {
  extractClockConfig,
  validateClockLimits,
  formatClockReport,
};
