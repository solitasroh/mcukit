/**
 * Control Panel Component
 * @module lib/ui/control-panel
 * @version 2.0.0
 *
 * Renders the automation control panel with level slider,
 * pending approvals, keyboard shortcuts, and emergency stop notice.
 */

const {
  BOX, SYMBOLS,
  colorize, bold, dim,
  getTermWidth, truncate, hline,
  stripAnsi, boxLine,
} = require('./ansi');

// ============================================================
// Constants
// ============================================================

const LEVEL_NAMES = {
  0: 'Manual',
  1: 'Guided',
  2: 'Semi-Auto',
  3: 'Auto',
  4: 'Full-Auto',
};

const LEVEL_COLORS = {
  0: 'green',
  1: 'green',
  2: 'yellow',
  3: 'red',
  4: 'red',
};

const SLIDER_WIDTH = 22;

const SHORTCUTS = [
  { cmd: '/pdca status',     desc: 'Show full PDCA status' },
  { cmd: '/pdca approve',    desc: 'Approve pending item' },
  { cmd: '/pdca reject',     desc: 'Reject current phase with feedback' },
  { cmd: '/pdca rollback',   desc: 'Rollback to last checkpoint' },
  { cmd: '/pdca map',        desc: 'Show workflow map' },
  { cmd: '/pdca team',       desc: 'Show Agent Team panel' },
  { cmd: '/control level N', desc: 'Change automation level (0-4)' },
];

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Render the automation level slider.
 * @param {number} level - 0-4
 * @returns {string[]} Array of lines for the slider section
 */
function renderSlider(level) {
  const safeLevel = Math.max(0, Math.min(4, level || 0));
  const color = LEVEL_COLORS[safeLevel] || 'yellow';
  const name = LEVEL_NAMES[safeLevel] || 'Unknown';

  // Build slider track: position the dot
  const positions = [0, 5, 11, 16, 21]; // approximate positions for L0-L4
  const pos = positions[safeLevel];
  const before = hline(pos);
  const after = hline(SLIDER_WIDTH - pos - 1);
  const dot = colorize('\u25CF', color); // ●
  const slider = `L0 ${before}${dot}${after} L4`;

  const labels = 'Manual  Semi-Auto  Full-Auto';
  const current = `[Current: L${safeLevel} ${name}]`;

  return [
    `Automation Level   ${slider}`,
    `                   ${labels}`,
    `                   ${colorize(current, color)}`,
  ];
}

// ============================================================
// Public API
// ============================================================

/**
 * Render control panel.
 * @param {Object|null} controlState     - .rkit/runtime/control-state.json
 * @param {number|null} automationLevel  - Current level (0-4), null reads from controlState
 * @param {Object} [opts]
 * @param {boolean} [opts.showShortcuts=true]  - Show keyboard shortcuts
 * @param {boolean} [opts.showApprovals=true]  - Show pending approvals
 * @param {number}  [opts.width]               - Force width
 * @returns {string}
 */
function renderControlPanel(controlState, automationLevel, opts = {}) {
  const width = opts.width || getTermWidth();
  const showShortcuts = opts.showShortcuts !== false;
  const showApprovals = opts.showApprovals !== false;
  const innerWidth = width - 6;

  // Resolve automation level
  const level = automationLevel != null
    ? automationLevel
    : (controlState && controlState.automationLevel != null
      ? controlState.automationLevel
      : 2);

  const pendingApprovals = (controlState && controlState.pendingApprovals) || [];

  const lines = [];

  // Title
  const title = ' Control Panel ';
  const titlePad = Math.max(1, width - title.length - 5);
  lines.push(`${BOX.topLeft}${hline(3)}${title}${hline(titlePad)}${BOX.topRight}`);

  lines.push(boxLine('', innerWidth));

  // Automation level slider
  const sliderLines = renderSlider(level);
  for (const sl of sliderLines) {
    lines.push(boxLine(sl, innerWidth));
  }

  lines.push(boxLine('', innerWidth));

  // Pending approvals
  if (showApprovals) {
    if (pendingApprovals.length > 0) {
      const approvalHeader = `${hline(3)} Pending Approvals (${pendingApprovals.length}) ${hline(Math.max(1, innerWidth - 30))}`;
      lines.push(boxLine(approvalHeader, innerWidth));

      for (const approval of pendingApprovals) {
        const from = approval.from || '?';
        const to = approval.to || '?';
        const desc = truncate(approval.description || '', innerWidth - 20);
        const icon = colorize(bold(SYMBOLS.waiting), 'yellow');
        const transition = `[${from.toUpperCase()}${BOX.arrowRight}${to.toUpperCase()}]`;
        lines.push(boxLine(`${icon} ${transition}  ${desc}`, innerWidth));
      }

      lines.push(boxLine(
        `  ${BOX.arrowRight} /pdca approve  or  /pdca reject`,
        innerWidth
      ));
    } else {
      lines.push(boxLine(
        colorize('No pending approvals', 'green'),
        innerWidth
      ));
    }

    lines.push(boxLine('', innerWidth));
  }

  // Keyboard shortcuts
  if (showShortcuts) {
    const shortcutHeader = `${hline(3)} Keyboard Shortcuts ${hline(Math.max(1, innerWidth - 25))}`;
    lines.push(boxLine(shortcutHeader, innerWidth));

    for (const sc of SHORTCUTS) {
      const cmdCol = sc.cmd.padEnd(20);
      lines.push(boxLine(`${bold(cmdCol)}${sc.desc}`, innerWidth));
    }

    lines.push(boxLine('', innerWidth));
  }

  // Emergency stop notice
  const stopNotice = `Emergency stop: ${bold('/control stop')}  or  ${bold('Ctrl+C')} ${dim('\u2192 rkit saves checkpoint and halts')}`;
  lines.push(boxLine(truncate(stopNotice, innerWidth), innerWidth));

  // Close box
  lines.push(`${BOX.bottomLeft}${hline(width - 2)}${BOX.bottomRight}`);

  return lines.join('\n');
}

// ============================================================
// Module Exports
// ============================================================

module.exports = { renderControlPanel };
