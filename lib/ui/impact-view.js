/**
 * Impact Analysis View Component
 * @module lib/ui/impact-view
 * @version 2.0.0
 *
 * Renders change impact analysis including match rate bar,
 * changed files tree, and iteration trend chart.
 */

const {
  BOX, SYMBOLS,
  colorize, bold, dim,
  getTermWidth, getWidthBreakpoint, truncate, hline,
  stripAnsi, boxLine, resolveFeature,
} = require('./ansi');

// ============================================================
// Constants
// ============================================================

const RATE_BAR_WIDTHS = {
  narrow: 16,
  normal: 24,
  wide: 36,
  ultrawide: 36,
};

const TREND_BAR_WIDTHS = {
  narrow: 12,
  normal: 20,
  wide: 20,
  ultrawide: 20,
};

const TREE_BRANCH  = '\u251C\u2500\u2500 ';  // ├──
const TREE_LAST    = '\u2514\u2500\u2500 ';  // └──
const TREE_PIPE    = '\u2502   ';             // │
const TREE_SPACE   = '    ';

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Get color for match rate value.
 * @param {number} rate
 * @returns {string}
 */
function rateColor(rate) {
  if (rate >= 90) return 'green';
  if (rate >= 70) return 'yellow';
  return 'red';
}

/**
 * Render a filled/empty bar.
 * @param {number} percent
 * @param {number} barWidth
 * @returns {string}
 */
function renderBar(percent, barWidth) {
  const filled = Math.round(barWidth * Math.min(100, Math.max(0, percent)) / 100);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
}

/**
 * Build a simplified file tree from a list of relative paths.
 * @param {string[]} files - Relative file paths
 * @param {number} maxDepth
 * @param {number} maxFiles
 * @returns {string[]} Lines of the tree rendering
 */
function buildFileTree(files, maxDepth, maxFiles) {
  if (!files || files.length === 0) return ['(no changed files)'];

  // Find common prefix
  const parts = files.map(f => f.replace(/\\/g, '/').split('/'));
  let prefix = [];
  if (parts.length > 1) {
    outer:
    for (let i = 0; i < parts[0].length; i++) {
      const seg = parts[0][i];
      for (let j = 1; j < parts.length; j++) {
        if (!parts[j][i] || parts[j][i] !== seg) break outer;
      }
      prefix.push(seg);
    }
  }

  // Build tree structure
  const tree = {};
  const displayed = files.slice(0, maxFiles);
  const remaining = files.length - displayed.length;

  for (const file of displayed) {
    const rel = file.replace(/\\/g, '/').split('/').slice(prefix.length);
    const truncatedPath = rel.length > maxDepth
      ? [...rel.slice(0, maxDepth - 1), rel.slice(maxDepth - 1).join('/')]
      : rel;

    let node = tree;
    for (let i = 0; i < truncatedPath.length; i++) {
      const seg = truncatedPath[i];
      if (i === truncatedPath.length - 1) {
        // Leaf node (file)
        node[seg] = null;
      } else {
        if (!node[seg] || typeof node[seg] !== 'object') {
          node[seg] = {};
        }
        node = node[seg];
      }
    }
  }

  // Render tree recursively
  const lines = [];
  function renderNode(obj, indent) {
    if (!obj || typeof obj !== 'object') return;
    const keys = Object.keys(obj).sort((a, b) => {
      // Directories first
      const aIsDir = obj[a] !== null;
      const bIsDir = obj[b] !== null;
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
      return a.localeCompare(b);
    });

    for (let i = 0; i < keys.length; i++) {
      const isLast = i === keys.length - 1;
      const branch = isLast ? TREE_LAST : TREE_BRANCH;
      const childIndent = indent + (isLast ? TREE_SPACE : TREE_PIPE);
      const key = keys[i];

      if (obj[key] !== null && typeof obj[key] === 'object') {
        // Directory
        lines.push(`${indent}${branch}${key}/`);
        renderNode(obj[key], childIndent);
      } else {
        // File
        lines.push(`${indent}${branch}${key}`);
      }
    }
  }

  if (prefix.length > 0) {
    lines.push(prefix.join('/') + '/');
  }
  renderNode(tree, prefix.length > 0 ? '  ' : '');

  if (remaining > 0) {
    lines.push(dim(`  \u2026 ${remaining} more files`));
  }

  return lines;
}

// ============================================================
// Public API
// ============================================================

/**
 * Render impact analysis view.
 * @param {Object|null} pdcaStatus - .rkit/state/pdca-status.json
 * @param {Object|null} gitDiff    - Git diff analysis result
 * @param {string[]}    [gitDiff.changedFiles]  - Changed file list
 * @param {Object}      [gitDiff.stats]         - { insertions, deletions, filesChanged }
 * @param {Object} [opts]
 * @param {string}  [opts.feature]     - Feature name
 * @param {number}  [opts.maxFiles=10] - Max files to display
 * @param {number}  [opts.treeDepth=3] - Max tree depth
 * @param {number}  [opts.width]       - Force width
 * @returns {string}
 */
function renderImpactView(pdcaStatus, gitDiff, opts = {}) {
  const width = opts.width || getTermWidth();
  const bp = getWidthBreakpoint();
  const maxFiles = opts.maxFiles != null ? opts.maxFiles : 10;
  const treeDepth = opts.treeDepth != null ? opts.treeDepth : 3;
  const innerWidth = width - 6;

  const { name: featureName, data: featureData } = resolveFeature(pdcaStatus, opts.feature);

  const lines = [];

  // Title
  const titleText = featureName
    ? ` Impact Analysis: ${truncate(featureName, 30)} `
    : ' Impact Analysis ';
  const titlePad = Math.max(1, width - titleText.length - 5);
  lines.push(`${BOX.topLeft}${hline(3)}${titleText}${hline(titlePad)}${BOX.topRight}`);

  lines.push(boxLine('', innerWidth));

  // Match Rate bar
  const matchRate = featureData && featureData.matchRate != null
    ? featureData.matchRate
    : null;

  if (matchRate != null) {
    const barWidth = RATE_BAR_WIDTHS[bp] || RATE_BAR_WIDTHS.normal;
    const bar = renderBar(matchRate, barWidth);
    const color = rateColor(matchRate);
    const rateStr = `${matchRate}%`;
    const target = '(target: 90%)';
    const rateLine = `Match Rate  ${colorize(bar, color)}  ${bold(rateStr)}  ${dim(target)}`;
    lines.push(boxLine(rateLine, innerWidth));
  } else {
    lines.push(boxLine(dim('Match Rate: N/A'), innerWidth));
  }

  lines.push(boxLine('', innerWidth));

  // Changed files section
  const changedFiles = (gitDiff && gitDiff.changedFiles) || [];
  const stats = (gitDiff && gitDiff.stats) || {};
  const insertions = stats.insertions || 0;
  const deletions = stats.deletions || 0;
  const filesChanged = stats.filesChanged || changedFiles.length;

  const filesHeader = `Changed Files (${filesChanged} files, ${colorize(`+${insertions}`, 'green')} / ${colorize(`-${deletions}`, 'red')})`;
  lines.push(boxLine(filesHeader, innerWidth));

  const treeLines = buildFileTree(changedFiles, treeDepth, maxFiles);
  for (const treeLine of treeLines) {
    lines.push(boxLine(truncate(treeLine, innerWidth), innerWidth));
  }

  lines.push(boxLine('', innerWidth));

  // Iteration match rate trend
  const iterHistory = featureData && featureData.iterationHistory;
  if (iterHistory && iterHistory.length > 0) {
    const trendBarWidth = TREND_BAR_WIDTHS[bp] || TREND_BAR_WIDTHS.normal;
    const trendHeader = `${hline(3)} Iteration Match Rate Trend ${hline(Math.max(1, innerWidth - 35))}`;
    lines.push(boxLine(trendHeader, innerWidth));

    for (const iter of iterHistory) {
      const iterNum = iter.iteration || '?';
      const rate = iter.matchRate != null ? iter.matchRate : 0;
      const isCurrent = !iter.completedAt;
      const color = rateColor(rate);
      const bar = colorize(renderBar(rate, trendBarWidth), color);
      const label = `Iter ${String(iterNum).padStart(2)}`;
      const rateStr = `${rate}%`;
      const currentTag = isCurrent ? bold(' (current)') : '';

      lines.push(boxLine(`${label} ${bar}  ${rateStr}${currentTag}`, innerWidth));
    }

    lines.push(boxLine('', innerWidth));
  }

  // Close box
  lines.push(`${BOX.bottomLeft}${hline(width - 2)}${BOX.bottomRight}`);

  return lines.join('\n');
}

// ============================================================
// Module Exports
// ============================================================

module.exports = { renderImpactView };
