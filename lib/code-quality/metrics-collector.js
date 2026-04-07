/**
 * Code Quality Metrics Collector
 * @module lib/code-quality/metrics-collector
 * @version 0.1.0
 *
 * Analyzes code structure metrics for a single file:
 * - Function length, parameter count, nesting depth
 * - File total lines
 * Saves metrics to .rkit/state/code-quality-metrics.json
 */

const fs = require('fs');
const path = require('path');

/** Sizing limits (matches refs/code-quality/common.md Section 5) */
const LIMITS = {
  functionLines: { warning: 40, error: 80 },
  params: { warning: 3, error: 5 },
  nestingDepth: { warning: 3, error: 5 },
  fileLines: { warning: 300, error: 500 },
  nestedLoops: { warning: 2, error: 3 },        // SQ-005
  branchChain: { warning: 5, error: 8 },         // SQ-006
  switchCases: { warning: 8, error: 12 },         // SQ-006b
  publicMethods: { warning: 7, error: 10 },       // SQ-007 (God Class signal)
};

/** Language-specific function detection patterns */
const FUNCTION_PATTERNS = {
  '.c':    { start: /^[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*\{/, end: '}' },
  '.cpp':  { start: /^[\w\s*&:<>]+\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?(?:override\s*)?(?:noexcept\s*)?\{/, end: '}' },
  '.h':    { start: /^[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*\{/, end: '}' },
  '.hpp':  { start: /^[\w\s*&:<>]+\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?(?:override\s*)?(?:noexcept\s*)?\{/, end: '}' },
  '.cs':   { start: /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(?:virtual\s+)?(?:override\s+)?[\w<>\[\]?]+\s+(\w+)\s*\([^)]*\)\s*\{?/, end: '}' },
  '.ts':   { start: /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(|(?:(?:public|private|protected)\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>\[\]|]+)?\s*\{)/, end: '}' },
  '.tsx':  { start: /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(|(?:(?:public|private|protected)\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[\w<>\[\]|]+)?\s*\{)/, end: '}' },
  '.js':   { start: /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(|(\w+)\s*\([^)]*\)\s*\{)/, end: '}' },
  '.jsx':  { start: /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(|(\w+)\s*\([^)]*\)\s*\{)/, end: '}' },
  '.py':   { start: /^\s*(?:async\s+)?def\s+(\w+)\s*\(/, end: null }, // Python uses indentation
};

/**
 * Count parameters in a function declaration line
 * @param {string} line
 * @returns {number}
 */
function countParams(line) {
  const match = line.match(/\(([^)]*)\)/);
  if (!match || !match[1].trim()) return 0;
  // Split by comma, filter empty
  return match[1].split(',').filter(p => p.trim()).length;
}

/**
 * Calculate max nesting depth in a code block
 * @param {string[]} lines
 * @param {string} ext - file extension
 * @returns {number}
 */
function calculateNestingDepth(lines, ext) {
  if (ext === '.py') {
    // Python: count indentation levels
    let maxDepth = 0;
    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const indent = line.length - line.trimStart().length;
      const depth = Math.floor(indent / 4); // assume 4-space indent
      if (depth > maxDepth) maxDepth = depth;
    }
    return maxDepth;
  }

  // Brace-based languages
  let depth = 0;
  let maxDepth = 0;
  for (const line of lines) {
    for (const ch of line) {
      if (ch === '{') { depth++; if (depth > maxDepth) maxDepth = depth; }
      else if (ch === '}') { depth = Math.max(0, depth - 1); }
    }
  }
  return maxDepth;
}

/**
 * Extract functions and their metrics from a file
 * @param {string} content - file content
 * @param {string} ext - file extension
 * @returns {Array<{name: string, lines: number, params: number, nestingDepth: number, startLine: number}>}
 */
function extractFunctions(content, ext) {
  const pattern = FUNCTION_PATTERNS[ext];
  if (!pattern) return [];

  const fileLines = content.split('\n');
  const functions = [];

  if (ext === '.py') {
    // Python: indentation-based function detection
    let i = 0;
    while (i < fileLines.length) {
      const match = fileLines[i].match(pattern.start);
      if (match) {
        const name = match[1];
        const startLine = i + 1;
        const params = countParams(fileLines[i]);
        const baseIndent = fileLines[i].length - fileLines[i].trimStart().length;

        // Find function end by indentation
        let endLine = i + 1;
        for (let j = i + 1; j < fileLines.length; j++) {
          const line = fileLines[j];
          if (line.trim() === '' || line.trim().startsWith('#')) { endLine = j; continue; }
          const indent = line.length - line.trimStart().length;
          if (indent <= baseIndent) break;
          endLine = j;
        }

        const bodyLines = fileLines.slice(i + 1, endLine + 1);
        const lineCount = bodyLines.filter(l => l.trim() && !l.trim().startsWith('#')).length;
        const nestingDepth = calculateNestingDepth(bodyLines, ext);

        functions.push({ name, lines: lineCount, params, nestingDepth, startLine });
        i = endLine + 1;
        continue;
      }
      i++;
    }
    return functions;
  }

  // Brace-based languages
  for (let i = 0; i < fileLines.length; i++) {
    const line = fileLines[i];
    const match = line.match(pattern.start);
    if (!match) continue;

    const name = match[1] || match[2] || 'anonymous';
    if (['if', 'else', 'for', 'while', 'switch', 'catch', 'class', 'struct', 'namespace'].includes(name)) continue;

    const startLine = i + 1;
    const params = countParams(line);

    // Find function body end by brace matching
    let depth = 0;
    let bodyStarted = false;
    let endIdx = i;
    for (let j = i; j < fileLines.length; j++) {
      for (const ch of fileLines[j]) {
        if (ch === '{') { depth++; bodyStarted = true; }
        else if (ch === '}') {
          depth--;
          if (bodyStarted && depth === 0) {
            endIdx = j;
            break;
          }
        }
      }
      if (bodyStarted && depth === 0) break;
      endIdx = j;
    }

    const bodyLines = fileLines.slice(i + 1, endIdx);
    const lineCount = bodyLines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('*')).length;
    const nestingDepth = calculateNestingDepth(bodyLines, ext) - 1; // subtract function's own brace level

    functions.push({ name, lines: lineCount, params, nestingDepth: Math.max(0, nestingDepth), startLine });
  }

  return functions;
}

/**
 * Detect nested loop depth in content
 * @param {string} content
 * @param {string} ext
 * @returns {{maxDepth: number, line: number}}
 */
function detectNestedLoops(content, ext) {
  const lines = content.split('\n');
  let maxDepth = 0;
  let maxLine = 0;

  if (ext === '.py') {
    const loopIndents = [];
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();
      if (!trimmed) continue;
      const indent = lines[i].length - trimmed.length;
      while (loopIndents.length > 0 && loopIndents[loopIndents.length - 1] >= indent) {
        loopIndents.pop();
      }
      if (/^\s*(for\s+|while\s+)/.test(lines[i])) {
        loopIndents.push(indent);
        if (loopIndents.length > maxDepth) { maxDepth = loopIndents.length; maxLine = i + 1; }
      }
    }
  } else {
    let braceDepth = 0;
    const loopStarts = [];
    for (let i = 0; i < lines.length; i++) {
      if (/\b(for\s*\(|while\s*\(|do\s*\{)/.test(lines[i])) {
        loopStarts.push(braceDepth);
        const currentDepth = loopStarts.filter(d => d >= braceDepth - 2).length;
        if (currentDepth > maxDepth) { maxDepth = currentDepth; maxLine = i + 1; }
      }
      const opens = (lines[i].match(/\{/g) || []).length;
      const closes = (lines[i].match(/\}/g) || []).length;
      braceDepth += opens - closes;
      if (braceDepth < 0) braceDepth = 0;
    }
  }
  return { maxDepth, line: maxLine };
}

/**
 * Detect if/else-if branch chain length
 * @param {string} content
 * @returns {{maxChain: number, line: number}}
 */
function detectBranchChains(content) {
  const lines = content.split('\n');
  let chainLen = 0;
  let maxChain = 0;
  let chainStartLine = 0;
  let maxLine = 0;

  for (let i = 0; i < lines.length; i++) {
    if (/\belse\s+if\b|\belif\b/.test(lines[i])) {
      if (chainLen === 0) chainStartLine = i + 1;
      chainLen++;
      if (chainLen > maxChain) { maxChain = chainLen; maxLine = chainStartLine; }
    } else if (!/^\s*(\/\/|#|\*)/.test(lines[i]) && lines[i].trim()) {
      chainLen = 0;
    }
  }
  return { maxChain: maxChain + 1, line: maxLine }; // +1 for initial if
}

/**
 * Count switch/match cases
 * @param {string} content
 * @returns {number}
 */
function countSwitchCases(content) {
  return (content.match(/\bcase\s+/g) || []).length;
}

/**
 * Detect God Class signal: public methods + file size combo
 * @param {string} content
 * @param {string} ext
 * @returns {{publicMethods: number, totalLines: number}}
 */
function detectGodClassSignal(content, ext) {
  let publicMethods = 0;
  if (['.cs'].includes(ext)) {
    publicMethods = (content.match(/\bpublic\s+(?:async\s+)?(?:virtual\s+)?(?:override\s+)?[\w<>\[\]?]+\s+\w+\s*\(/g) || []).length;
  } else if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    publicMethods = (content.match(/(?:export\s+(?:async\s+)?function|public\s+(?:async\s+)?\w+\s*\()/g) || []).length;
  } else if (['.py'].includes(ext)) {
    publicMethods = (content.match(/^\s{4}def\s+(?!_)\w+\s*\(/gm) || []).length;
  }
  return { publicMethods, totalLines: content.split('\n').length };
}

/**
 * Detect architecture layer violations (cross-layer imports)
 * @param {string} filePath
 * @param {string} content
 * @returns {string[]} violation descriptions
 */
function detectArchViolations(filePath, content) {
  const violations = [];
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();

  // Determine current layer
  let currentLayer = null;
  if (/[/\\]domain[/\\]/i.test(normalized)) currentLayer = 'domain';
  else if (/[/\\]application[/\\]/i.test(normalized)) currentLayer = 'application';
  else if (/[/\\]infrastructure[/\\]/i.test(normalized)) currentLayer = 'infrastructure';
  else if (/[/\\]presentation[/\\]/i.test(normalized)) currentLayer = 'presentation';

  if (!currentLayer) return violations;

  const imports = content.match(/(?:import\s+.*from\s+['"]|require\s*\(\s*['"]|using\s+)([^'";\s]+)/g) || [];
  const forbidden = {
    domain: ['infrastructure', 'presentation', 'application'],
    application: ['infrastructure', 'presentation'],
    infrastructure: ['presentation'],
    presentation: [],
  };

  for (const imp of imports) {
    const impLower = imp.toLowerCase();
    for (const layer of (forbidden[currentLayer] || [])) {
      if (impLower.includes(layer)) {
        violations.push(`${currentLayer} imports ${layer}`);
      }
    }
  }
  return violations;
}

/**
 * Check structure metrics and return violations
 * @param {string} filePath
 * @param {string} content
 * @returns {{violations: Array<{rule: string, message: string, line: number, severity: string}>, metrics: Object}}
 */
function checkStructure(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();
  const lines = content.split('\n');
  const totalLines = lines.length;
  const violations = [];

  // File length check
  if (totalLines > LIMITS.fileLines.error) {
    violations.push({ rule: 'SQ-004', message: `File has ${totalLines} lines (limit: ${LIMITS.fileLines.error})`, line: 1, severity: 'error' });
  } else if (totalLines > LIMITS.fileLines.warning) {
    violations.push({ rule: 'SQ-004', message: `File has ${totalLines} lines (limit: ${LIMITS.fileLines.warning})`, line: 1, severity: 'warning' });
  }

  // Function-level checks
  const functions = extractFunctions(content, ext);

  for (const fn of functions) {
    // Function length
    if (fn.lines > LIMITS.functionLines.error) {
      violations.push({ rule: 'SQ-001', message: `${fn.name}() has ${fn.lines} lines (limit: ${LIMITS.functionLines.error})`, line: fn.startLine, severity: 'error' });
    } else if (fn.lines > LIMITS.functionLines.warning) {
      violations.push({ rule: 'SQ-001', message: `${fn.name}() has ${fn.lines} lines (limit: ${LIMITS.functionLines.warning})`, line: fn.startLine, severity: 'warning' });
    }

    // Parameter count
    if (fn.params > LIMITS.params.error) {
      violations.push({ rule: 'SQ-002', message: `${fn.name}() has ${fn.params} params (limit: ${LIMITS.params.error})`, line: fn.startLine, severity: 'error' });
    } else if (fn.params > LIMITS.params.warning) {
      violations.push({ rule: 'SQ-002', message: `${fn.name}() has ${fn.params} params (limit: ${LIMITS.params.warning})`, line: fn.startLine, severity: 'warning' });
    }

    // Nesting depth
    if (fn.nestingDepth > LIMITS.nestingDepth.error) {
      violations.push({ rule: 'SQ-003', message: `${fn.name}() has nesting depth ${fn.nestingDepth} (limit: ${LIMITS.nestingDepth.error})`, line: fn.startLine, severity: 'error' });
    } else if (fn.nestingDepth > LIMITS.nestingDepth.warning) {
      violations.push({ rule: 'SQ-003', message: `${fn.name}() has nesting depth ${fn.nestingDepth} (limit: ${LIMITS.nestingDepth.warning})`, line: fn.startLine, severity: 'warning' });
    }
  }

  // SQ-005: Nested loops
  const loops = detectNestedLoops(content, ext);
  if (loops.maxDepth >= LIMITS.nestedLoops.error) {
    violations.push({ rule: 'SQ-005', message: `Nested loops depth ${loops.maxDepth} (limit: ${LIMITS.nestedLoops.error}). Extract inner loop or use pipeline.`, line: loops.line, severity: 'error' });
  } else if (loops.maxDepth >= LIMITS.nestedLoops.warning) {
    violations.push({ rule: 'SQ-005', message: `Nested loops depth ${loops.maxDepth} (limit: ${LIMITS.nestedLoops.warning}). Consider extracting inner loop.`, line: loops.line, severity: 'warning' });
  }

  // SQ-006: Branch chains (if/else if)
  const branches = detectBranchChains(content);
  if (branches.maxChain >= LIMITS.branchChain.error) {
    violations.push({ rule: 'SQ-006', message: `Branch chain ${branches.maxChain} deep (limit: ${LIMITS.branchChain.error}). Use Strategy/lookup table.`, line: branches.line, severity: 'error' });
  } else if (branches.maxChain >= LIMITS.branchChain.warning) {
    violations.push({ rule: 'SQ-006', message: `Branch chain ${branches.maxChain} deep (limit: ${LIMITS.branchChain.warning}). Consider Strategy pattern.`, line: branches.line, severity: 'warning' });
  }

  // SQ-006b: Switch cases
  const cases = countSwitchCases(content);
  if (cases >= LIMITS.switchCases.error) {
    violations.push({ rule: 'SQ-006b', message: `Switch has ${cases} cases (limit: ${LIMITS.switchCases.error}). Use lookup table/registry.`, line: 1, severity: 'error' });
  } else if (cases >= LIMITS.switchCases.warning) {
    violations.push({ rule: 'SQ-006b', message: `Switch has ${cases} cases (limit: ${LIMITS.switchCases.warning}). Consider lookup table.`, line: 1, severity: 'warning' });
  }

  // SQ-007: God Class signal
  const godClass = detectGodClassSignal(content, ext);
  if (godClass.publicMethods >= LIMITS.publicMethods.error && totalLines >= LIMITS.fileLines.warning) {
    violations.push({ rule: 'SQ-007', message: `God Class: ${godClass.publicMethods} public methods + ${totalLines} lines. Split by responsibility.`, line: 1, severity: 'error' });
  } else if (godClass.publicMethods >= LIMITS.publicMethods.warning && totalLines >= LIMITS.fileLines.warning) {
    violations.push({ rule: 'SQ-007', message: `God Class risk: ${godClass.publicMethods} public methods + ${totalLines} lines. Consider splitting.`, line: 1, severity: 'warning' });
  }

  // SQ-008: Architecture violations
  const archViolations = detectArchViolations(filePath, content);
  for (const av of archViolations) {
    violations.push({ rule: 'SQ-008', message: `Architecture violation: ${av}. Dependencies must point inward.`, line: 1, severity: 'warning' });
  }

  const metrics = {
    totalLines,
    functions: functions.map(f => ({ name: f.name, lines: f.lines, params: f.params, nestingDepth: f.nestingDepth, startLine: f.startLine })),
    maxNestingDepth: functions.length > 0 ? Math.max(...functions.map(f => f.nestingDepth)) : 0,
    maxLoopDepth: loops.maxDepth,
    maxBranchChain: branches.maxChain,
    switchCases: cases,
    publicMethods: godClass.publicMethods,
    archViolations: archViolations.length,
    violationCount: violations.length,
    lastChecked: new Date().toISOString(),
  };

  return { violations, metrics };
}

/**
 * Save metrics to .rkit/state/code-quality-metrics.json
 * @param {string} filePath - relative or absolute file path
 * @param {Object} metrics - from checkStructure
 */
function saveMetrics(filePath, metrics) {
  const stateDir = path.join(process.cwd(), '.rkit', 'state');
  const metricsPath = path.join(stateDir, 'code-quality-metrics.json');

  let data = { version: '1.0', lastUpdated: '', files: {}, summary: {} };
  try {
    if (fs.existsSync(metricsPath)) {
      data = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
    }
  } catch { /* fresh start */ }

  // Normalize path
  const relPath = path.isAbsolute(filePath)
    ? path.relative(process.cwd(), filePath)
    : filePath;

  data.files[relPath] = metrics;
  data.lastUpdated = new Date().toISOString();

  // Recalculate summary
  const allFiles = Object.values(data.files);
  const allFunctions = allFiles.flatMap(f => f.functions || []);
  data.summary = {
    totalFiles: allFiles.length,
    totalViolations: allFiles.reduce((sum, f) => sum + (f.violationCount || 0), 0),
    avgFunctionLength: allFunctions.length > 0 ? Math.round(allFunctions.reduce((s, f) => s + f.lines, 0) / allFunctions.length) : 0,
    avgParams: allFunctions.length > 0 ? +(allFunctions.reduce((s, f) => s + f.params, 0) / allFunctions.length).toFixed(1) : 0,
    maxNestingDepth: allFunctions.length > 0 ? Math.max(...allFunctions.map(f => f.nestingDepth)) : 0,
  };

  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(metricsPath, JSON.stringify(data, null, 2));
  } catch { /* non-critical */ }
}

/**
 * Format violations for stderr output (Claude sees this as feedback)
 * @param {string} filePath
 * @param {Array} violations
 * @returns {string}
 */
function formatViolations(filePath, violations) {
  if (violations.length === 0) return '';

  const lines = [`\n[Code Quality] ${violations.length} issue(s) in ${filePath}:`];
  for (const v of violations) {
    const icon = v.severity === 'error' ? 'ERROR' : 'WARN';
    lines.push(`  ${icon} ${v.rule} line ${v.line}: ${v.message}`);
  }
  lines.push('  Fix: Extract helper functions, reduce parameters, flatten nesting.\n');
  return lines.join('\n');
}

module.exports = {
  checkStructure,
  saveMetrics,
  formatViolations,
  extractFunctions,
  detectNestedLoops,
  detectBranchChains,
  countSwitchCases,
  detectGodClassSignal,
  detectArchViolations,
  LIMITS,
};
