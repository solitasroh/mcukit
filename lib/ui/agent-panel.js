/**
 * Agent Team Panel Component
 * @module lib/ui/agent-panel
 * @version 2.0.0
 *
 * Renders the Agent Team status panel including teammate roster,
 * recent communications, and orchestration pattern.
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

const STATUS_ICON = {
  spawning:  SYMBOLS.spawning,
  working:   SYMBOLS.running,
  idle:      SYMBOLS.idle,
  completed: SYMBOLS.done,
  failed:    SYMBOLS.failed,
  pending:   SYMBOLS.pending,
};

const STATUS_COLOR = {
  spawning:  'yellow',
  working:   'cyan',
  idle:      'white',
  completed: 'green',
  failed:    'red',
  pending:   'gray',
};

const PATTERN_DISPLAY = {
  leader:     'leader',
  parallel:   'parallel swarm',
  sequential: 'sequential',
  hybrid:     'hybrid',
};

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Format a timestamp as HH:MM:SS.
 * @param {string} isoTime
 * @returns {string}
 */
function formatTime(isoTime) {
  if (!isoTime) return '';
  try {
    const d = new Date(isoTime);
    return d.toTimeString().slice(0, 8);
  } catch {
    return '';
  }
}

// ============================================================
// Public API
// ============================================================

/**
 * Render Agent Team panel.
 * @param {Object|null} agentState - .mcukit/runtime/agent-state.json
 * @param {Object} [opts]
 * @param {number} [opts.maxMessages=5] - Number of recent messages to show
 * @param {boolean} [opts.showPattern=true] - Show orchestration pattern in header
 * @param {number}  [opts.width] - Force width
 * @returns {string}
 */
function renderAgentPanel(agentState, opts = {}) {
  const width = opts.width || getTermWidth();
  const maxMessages = opts.maxMessages != null ? opts.maxMessages : 5;
  const showPattern = opts.showPattern !== false;
  const innerWidth = width - 6;

  // Inactive / no state fallback
  if (!agentState || !agentState.enabled) {
    const title = ' Agent Team ';
    const titlePad = Math.max(1, width - title.length - 5);
    return [
      `${BOX.topLeft}${hline(3)}${title}${hline(titlePad)}${BOX.topRight}`,
      boxLine('Agent Team is inactive.', innerWidth),
      boxLine('Use /pdca team to check team status or', innerWidth),
      boxLine('start a CTO Team skill to launch agents.', innerWidth),
      `${BOX.bottomLeft}${hline(width - 2)}${BOX.bottomRight}`,
    ].join('\n');
  }

  const lines = [];

  // Header with team name and pattern
  const teamName = agentState.teamName || 'Agent Team';
  const patternStr = showPattern && agentState.orchestrationPattern
    ? `Pattern: ${PATTERN_DISPLAY[agentState.orchestrationPattern] || agentState.orchestrationPattern}`
    : '';

  const titleLeft = ` Agent Team: ${truncate(teamName, 25)} `;
  const titleRight = patternStr ? ` ${patternStr} ` : '';
  const titleFill = Math.max(1, width - titleLeft.length - titleRight.length - 4);
  lines.push(
    `${BOX.topLeft}${hline(3)}${titleLeft}${hline(titleFill)}${titleRight}${hline(1)}${BOX.topRight}`
  );

  lines.push(boxLine('', innerWidth));

  // Teammate roster
  const teammates = agentState.teammates || [];
  if (teammates.length === 0) {
    lines.push(boxLine(dim('No teammates registered.'), innerWidth));
  } else {
    for (const t of teammates) {
      const status = t.status || 'pending';
      const icon = STATUS_ICON[status] || SYMBOLS.pending;
      const color = STATUS_COLOR[status] || 'gray';
      const nameCol = truncate(t.name || 'unknown', 18).padEnd(18);
      const statusCol = `[${status}]`.padEnd(12);
      const task = truncate(t.currentTask || '', innerWidth - 38);

      const styledIcon = colorize(icon, color);
      const styledStatus = colorize(statusCol, color);
      lines.push(boxLine(`${styledIcon}  ${nameCol}${styledStatus}${task}`, innerWidth));
    }
  }

  lines.push(boxLine('', innerWidth));

  // Recent communications
  const messages = agentState.recentMessages || [];
  if (messages.length > 0 && maxMessages > 0) {
    const recentHeader = `${hline(3)} Recent Communications (last ${Math.min(messages.length, maxMessages)}) ${hline(Math.max(1, innerWidth - 40))}`;
    lines.push(boxLine(recentHeader, innerWidth));

    const recentSlice = messages.slice(-maxMessages);
    for (const msg of recentSlice) {
      const from = truncate(msg.from || '?', 10);
      const to = truncate(msg.to || '?', 10);
      const content = truncate(msg.content || '', innerWidth - 40);
      const time = formatTime(msg.timestamp);
      const direction = `${from}${BOX.arrowRight}${to}:`;
      const padding = Math.max(0, innerWidth - stripAnsi(direction).length - content.length - time.length - 6);
      lines.push(boxLine(
        `${dim(direction)}  ${content}${' '.repeat(padding)}  ${dim(time)}`,
        innerWidth
      ));
    }

    lines.push(boxLine('', innerWidth));
  }

  // Task summary footer
  const progress = agentState.progress || {};
  const parts = [];
  if (progress.totalTasks != null) parts.push(`Tasks: ${progress.totalTasks} total`);
  if (progress.inProgressTasks) parts.push(`${progress.inProgressTasks} working`);
  if (progress.completedTasks) parts.push(`${progress.completedTasks} done`);
  if (progress.failedTasks) parts.push(`${progress.failedTasks} failed`);
  if (progress.pendingTasks) parts.push(`${progress.pendingTasks} pending`);

  if (parts.length > 0) {
    lines.push(boxLine(
      truncate(parts.join(`  ${SYMBOLS.bullet}  `), innerWidth),
      innerWidth
    ));
  }

  // Close box
  lines.push(`${BOX.bottomLeft}${hline(width - 2)}${BOX.bottomRight}`);

  return lines.join('\n');
}

// ============================================================
// Module Exports
// ============================================================

module.exports = { renderAgentPanel };
