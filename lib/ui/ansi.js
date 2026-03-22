/**
 * ANSI Escape Code Utilities
 * @module lib/ui/ansi
 * @version 2.0.0
 *
 * Pure ANSI escape codes + Unicode Box Drawing.
 * NO external dependencies (chalk, blessed, ink, etc.).
 * Respects NO_COLOR env var and non-TTY environments.
 */

// ============================================================
// Color Detection
// ============================================================

/**
 * Determine if ANSI colors should be disabled.
 * Disabled when: NO_COLOR is set, ANSI_DISABLED is set, or stdout is not a TTY.
 * @returns {boolean}
 */
function isColorDisabled() {
  return !!(
    process.env.NO_COLOR ||
    process.env.ANSI_DISABLED ||
    (process.stdout && !process.stdout.isTTY)
  );
}

// ============================================================
// Constants
// ============================================================

const COLORS = Object.freeze({
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
  reset:   '\x1b[0m',
});

const STYLES = Object.freeze({
  bold:      '\x1b[1m',
  dim:       '\x1b[2m',
  underline: '\x1b[4m',
  reset:     '\x1b[0m',
});

const BOX = Object.freeze({
  topLeft:     '\u250C',
  topRight:    '\u2510',
  bottomLeft:  '\u2514',
  bottomRight: '\u2518',
  horizontal:  '\u2500',
  vertical:    '\u2502',
  leftT:       '\u251C',
  rightT:      '\u2524',
  topT:        '\u252C',
  bottomT:     '\u2534',
  cross:       '\u253C',
  arrowRight:  '\u2192',
  arrowDown:   '\u2193',
});

const SYMBOLS = Object.freeze({
  done:     '\u2713',
  running:  '\u25B6',
  pending:  '\u00B7',
  failed:   '\u2717',
  waiting:  '!',
  idle:     '\u25C9',
  spawning: '\u25CB',
  bullet:   '\u2022',
});

// ============================================================
// Style Functions
// ============================================================

/**
 * Apply color to text. Returns plain text if color is disabled.
 * @param {string} text
 * @param {string} color - Key from COLORS object
 * @returns {string}
 */
function colorize(text, color) {
  if (isColorDisabled() || !COLORS[color]) return String(text);
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

/**
 * Apply bold style to text.
 * @param {string} text
 * @returns {string}
 */
function bold(text) {
  if (isColorDisabled()) return String(text);
  return `${STYLES.bold}${text}${STYLES.reset}`;
}

/**
 * Apply dim style to text.
 * @param {string} text
 * @returns {string}
 */
function dim(text) {
  if (isColorDisabled()) return String(text);
  return `${STYLES.dim}${text}${STYLES.reset}`;
}

/**
 * Apply underline style to text.
 * @param {string} text
 * @returns {string}
 */
function underline(text) {
  if (isColorDisabled()) return String(text);
  return `${STYLES.underline}${text}${STYLES.reset}`;
}

/**
 * Apply multiple styles sequentially.
 * @param {string} text
 * @param {string[]} styles - Array of ANSI escape code strings (from COLORS or STYLES)
 * @returns {string}
 */
function styled(text, styles) {
  if (isColorDisabled() || !Array.isArray(styles) || styles.length === 0) {
    return String(text);
  }
  return `${styles.join('')}${text}${STYLES.reset}`;
}

// ============================================================
// Layout Utilities
// ============================================================

/**
 * Get current terminal width. Returns 80 in non-TTY (hook) environments.
 * @returns {number}
 */
function getTermWidth() {
  if (process.stdout && process.stdout.columns) {
    return process.stdout.columns;
  }
  return 80;
}

/**
 * Get width breakpoint category.
 * @returns {'narrow'|'normal'|'wide'|'ultrawide'}
 */
function getWidthBreakpoint() {
  const w = getTermWidth();
  if (w < 80) return 'narrow';
  if (w < 120) return 'normal';
  if (w < 160) return 'wide';
  return 'ultrawide';
}

/**
 * Truncate text to maxLen, appending ellipsis if truncated.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(text, maxLen) {
  if (!text) return '';
  if (maxLen < 1) return '';
  if (text.length <= maxLen) return text;
  if (maxLen <= 1) return '\u2026';
  return text.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Create a horizontal line using Box Drawing characters.
 * @param {number} width
 * @param {string} [char] - Character to repeat (default: BOX.horizontal)
 * @returns {string}
 */
function hline(width, char) {
  const c = char || BOX.horizontal;
  return c.repeat(Math.max(0, width));
}

/**
 * Center text within a given width, padding with spaces.
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
function center(text, width) {
  const t = String(text);
  if (t.length >= width) return t;
  const leftPad = Math.floor((width - t.length) / 2);
  const rightPad = width - t.length - leftPad;
  return ' '.repeat(leftPad) + t + ' '.repeat(rightPad);
}

// ============================================================
// Shared Helpers (extracted from UI modules to avoid duplication)
// ============================================================

/**
 * Strip ANSI escape sequences from a string.
 * @param {string} str
 * @returns {string}
 */
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return String(str).replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Pad content inside a box line with vertical borders.
 * @param {string} content - Text content (may include ANSI codes)
 * @param {number} innerWidth - Target inner width
 * @returns {string}
 */
function boxLine(content, innerWidth) {
  const visLen = stripAnsi(content).length;
  const pad = Math.max(0, innerWidth - visLen);
  return `${BOX.vertical}  ${content}${' '.repeat(pad)}  ${BOX.vertical}`;
}

/**
 * Resolve a feature name and data from pdcaStatus.
 * @param {Object} pdcaStatus - Full PDCA status object
 * @param {string} [featureName] - Optional explicit feature name
 * @returns {{ name: string, data: Object|null }}
 */
function resolveFeature(pdcaStatus, featureName) {
  if (!pdcaStatus || !pdcaStatus.features) return { name: '', data: null };
  const name = featureName || pdcaStatus.primaryFeature || '';
  const data = name ? (pdcaStatus.features[name] || null) : null;
  return { name, data };
}

// ============================================================
// Module Exports
// ============================================================

module.exports = {
  COLORS,
  STYLES,
  BOX,
  SYMBOLS,
  colorize,
  bold,
  dim,
  underline,
  styled,
  getTermWidth,
  getWidthBreakpoint,
  truncate,
  hline,
  center,
  isColorDisabled,
  stripAnsi,
  boxLine,
  resolveFeature,
};
