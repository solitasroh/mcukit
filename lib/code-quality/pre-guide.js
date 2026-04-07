/**
 * Pre-write Structural Guide Generator
 * @module lib/code-quality/pre-guide
 * @version 1.0.0
 *
 * Analyzes file context and content to produce targeted quality guidance
 * BEFORE code is written. Replaces the old fixed-text hint in pre-write.js Section 4.5.
 *
 * Design principle: Token optimization.
 * - Instead of loading full refs docs (70KB) via imports,
 * - Injects only the relevant core rules in 1-3 lines per concern
 * - Total Pre guide: max ~300 tokens (vs ~9,500 tokens for full refs imports)
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// (A) Layer Detection — Architecture boundary enforcement
// ============================================================

const LAYER_PATTERNS = {
  domain:         [/[/\\]domain[/\\]/i, /[/\\]entities[/\\]/i, /[/\\]valueobjects?[/\\]/i, /[/\\]core[/\\]/i],
  application:    [/[/\\]application[/\\]/i, /[/\\]usecases?[/\\]/i, /[/\\]commands?[/\\]/i, /[/\\]queries?[/\\]/i, /[/\\]handlers?[/\\]/i],
  infrastructure: [/[/\\]infrastructure[/\\]/i, /[/\\]persistence[/\\]/i, /[/\\]repositories[/\\]/i, /[/\\]external[/\\]/i, /[/\\]adapters?[/\\]/i],
  presentation:   [/[/\\]presentation[/\\]/i, /[/\\]controllers?[/\\]/i, /[/\\]views?[/\\]/i, /[/\\]viewmodels?[/\\]/i, /[/\\]pages?[/\\]/i, /[/\\]api[/\\]/i],
};

const LAYER_RULES = {
  domain:         'DOMAIN LAYER: No imports from Infrastructure/Presentation/Application. Define interfaces here, implement elsewhere.',
  application:    'APPLICATION LAYER: Orchestrate use cases. Depend on Domain interfaces only. No UI/DB imports.',
  infrastructure: 'INFRA LAYER: Implement Domain interfaces. No Presentation imports.',
  presentation:   'PRESENTATION LAYER: Depend on Application/Domain. No direct Infrastructure imports.',
};

/**
 * Detect architecture layer from file path
 * @param {string} filePath
 * @returns {string|null} layer name or null
 */
function detectLayer(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  for (const [layer, patterns] of Object.entries(LAYER_PATTERNS)) {
    if (patterns.some(p => p.test(normalized))) return layer;
  }
  return null;
}

// ============================================================
// (B) Anti-pattern Detection — Pre-write warnings
// ============================================================

/**
 * Count public methods in existing file content
 * @param {string} content
 * @param {string} ext
 * @returns {number}
 */
function countPublicMethods(content, ext) {
  if (['.cs'].includes(ext)) {
    return (content.match(/\bpublic\s+(?:async\s+)?(?:virtual\s+)?(?:override\s+)?[\w<>\[\]?]+\s+\w+\s*\(/g) || []).length;
  }
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    return (content.match(/(?:export\s+(?:async\s+)?function|public\s+(?:async\s+)?\w+\s*\()/g) || []).length;
  }
  if (['.cpp', '.hpp', '.h', '.cc'].includes(ext)) {
    const publicSections = content.match(/\bpublic:[\s\S]*?(?=\b(?:private|protected|};))/g) || [];
    return publicSections.join('').split(/\n/).filter(l => l.match(/\w+\s*\(/)).length;
  }
  if (['.py'].includes(ext)) {
    return (content.match(/^\s{4}def\s+(?!_)\w+\s*\(/gm) || []).length;
  }
  return 0;
}

/**
 * Detect anti-patterns in existing file + incoming content
 * @param {string} filePath
 * @param {string|null} content - content being written
 * @returns {string[]} warning messages
 */
function detectAntiPatterns(filePath, content) {
  const warnings = [];
  const ext = path.extname(filePath).toLowerCase();

  // Read existing file for Edit operations
  let existingLines = 0;
  let existingPublicMethods = 0;
  try {
    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf-8');
      existingLines = existing.split('\n').length;
      existingPublicMethods = countPublicMethods(existing, ext);
    }
  } catch { /* skip if unreadable */ }

  // 1. God Class — file already bloated
  if (existingPublicMethods >= 7 || existingLines >= 300) {
    warnings.push(
      `GOD CLASS risk: ${existingPublicMethods} public methods, ${existingLines} lines. ` +
      `Split by responsibility (SRP) BEFORE adding more.`
    );
  }

  if (!content) return warnings;

  // 2. Feature Envy — accessing another object's fields excessively
  const dotAccess = content.match(/\b(\w+)\.\w+/g) || [];
  const objectCounts = {};
  const SELF_REFS = ['this', 'self', 'Math', 'console', 'std', 'System', 'path', 'fs', 'JSON', 'Object', 'Array', 'String', 'Number', 'Promise'];
  for (const access of dotAccess) {
    const obj = access.split('.')[0];
    if (!SELF_REFS.includes(obj)) {
      objectCounts[obj] = (objectCounts[obj] || 0) + 1;
    }
  }
  const envyTargets = Object.entries(objectCounts).filter(([, count]) => count >= 4);
  if (envyTargets.length > 0) {
    const [target, count] = envyTargets[0];
    warnings.push(
      `FEATURE ENVY: ${count}+ accesses to '${target}'. Consider moving this logic into ${target}'s class.`
    );
  }

  // 3. Primitive Obsession — function with 3+ primitive params
  const primitiveTypes = /\b(string|int|float|double|bool|boolean|number|str|char|byte|long)\b/gi;
  const funcDecls = content.match(/\([^)]{30,}\)/g) || [];
  for (const decl of funcDecls) {
    const primitives = (decl.match(primitiveTypes) || []).length;
    const params = decl.split(',').length;
    if (primitives >= 3 && params >= 3) {
      warnings.push(
        `PRIMITIVE OBSESSION: ${params} params, ${primitives} primitives. Introduce Value Object or Parameter Object.`
      );
      break;
    }
  }

  // 4. Long Parameter List — 4+ params (if not already caught by #3)
  if (!warnings.some(w => w.includes('PRIMITIVE'))) {
    const longParams = content.match(/\(([^)]*,){3,}[^)]*\)/g);
    if (longParams) {
      const paramCount = longParams[0].split(',').length;
      warnings.push(
        `LONG PARAM LIST: ${paramCount} params. Use Parameter Object or Builder pattern.`
      );
    }
  }

  // 5. Magic Numbers — unnamed numeric literals
  const magicNumbers = content.match(/[^=<>!]\s+\b\d{2,}\b(?!\s*[;,)\]}])/g);
  if (magicNumbers && magicNumbers.length >= 3) {
    warnings.push('MAGIC NUMBERS: Extract numeric literals to named constants.');
  }

  return warnings;
}

// ============================================================
// (C) Design Pattern Suggestion — Right pattern, right place
// ============================================================

/**
 * Analyze content for design pattern opportunities or anti-opportunities.
 * KEY: Also tells when NOT to use a pattern (premature pattern = anti-pattern).
 * @param {string} content
 * @param {string} filePath
 * @returns {string[]} suggestions
 */
function suggestDesignPattern(content, filePath) {
  const suggestions = [];

  // Signal 1: Branch chain (if/else if) — check if same axis
  const elseIfCount = (content.match(/\belse\s+if\b|\belif\b/g) || []).length;
  if (elseIfCount >= 4) {
    const typeChecks = content.match(/(?:===?\s*['"](\w+)['"]|instanceof\s+(\w+)|is\s+(\w+))/g) || [];
    if (typeChecks.length >= 3) {
      suggestions.push(
        `STRATEGY needed: ${elseIfCount + 1} branches on same axis (type/status). ` +
        `Define interface + implementations, or use lookup table: Record<string, Handler>.`
      );
    } else {
      suggestions.push(
        `${elseIfCount + 1} branches on different axes. Extract each to named function for readability.`
      );
    }
  } else if (elseIfCount >= 2 && elseIfCount < 4) {
    suggestions.push(
      `${elseIfCount + 1} branches: simple conditional is fine. Do NOT over-engineer with Strategy for <4 branches.`
    );
  }

  // Signal 2: State-based branching — State pattern
  const stateChecks = content.match(
    /(?:status|state|phase|mode)\s*(?:===?|==|\.equals)\s*['"](\w+)['"]/gi
  ) || [];
  const uniqueStates = [...new Set(stateChecks.map(s => s.match(/['"](\w+)['"]/)?.[1]).filter(Boolean))];
  if (uniqueStates.length >= 3) {
    suggestions.push(
      `STATE pattern: ${uniqueStates.length} states (${uniqueStates.slice(0, 3).join(', ')}...). ` +
      `Replace state-checking if/else with State objects.`
    );
  }

  // Signal 3: Type-based object creation — Factory pattern
  const newByType = content.match(/(?:new\s+\w+|create\w+)\s*\(/g) || [];
  const typeSwitch = content.match(/(?:switch|if).*(?:type|kind|category)/gi) || [];
  if (newByType.length >= 3 && typeSwitch.length >= 1) {
    suggestions.push(
      `FACTORY pattern: object creation varies by type. Extract to Factory method.`
    );
  }

  // Signal 4: Constructor with many params — Builder pattern
  const ctorParams = content.match(/constructor\s*\(([^)]*)\)/);
  if (ctorParams) {
    const paramCount = ctorParams[1].split(',').filter(p => p.trim()).length;
    if (paramCount >= 4) {
      suggestions.push(
        `BUILDER pattern: constructor has ${paramCount} params. Use step-by-step builder.`
      );
    }
  }

  // Signal 5: Event registrations — Observer pattern (warn on cleanup)
  const eventRegs = content.match(/\b(?:addEventListener|on\w+|subscribe|addListener|\.on\()/g) || [];
  if (eventRegs.length >= 3) {
    suggestions.push(
      `OBSERVER pattern in use. Ensure: unsubscribe on cleanup, avoid circular notifications.`
    );
  }

  return suggestions;
}

// ============================================================
// (D) Structural Risk Analysis — Loop/Branch complexity
// ============================================================

/**
 * Detect nested loops and excessive branching
 * @param {string} content
 * @param {string} filePath
 * @returns {string[]} warnings
 */
function analyzeStructuralRisks(content, filePath) {
  const warnings = [];
  const ext = path.extname(filePath).toLowerCase();

  // 1. Nested loops — O(n^2)+ complexity
  const lines = content.split('\n');
  let loopDepth = 0;
  let maxLoopDepth = 0;
  const loopPattern = ext === '.py'
    ? /^\s*(for\s+|while\s+)/
    : /\b(for\s*\(|while\s*\(|do\s*\{)/;
  const braceOpen = /\{/g;
  const braceClose = /\}/g;

  if (ext === '.py') {
    // Python: track indentation-based loop nesting
    const loopIndents = [];
    for (const line of lines) {
      const trimmed = line.trimStart();
      if (!trimmed) continue;
      const indent = line.length - trimmed.length;
      // Remove loops that are at same or higher indent level
      while (loopIndents.length > 0 && loopIndents[loopIndents.length - 1] >= indent) {
        loopIndents.pop();
      }
      if (loopPattern.test(line)) {
        loopIndents.push(indent);
        if (loopIndents.length > maxLoopDepth) maxLoopDepth = loopIndents.length;
      }
    }
  } else {
    // Brace-based: simplified heuristic — count loop keywords at different brace depths
    let braceDepth = 0;
    const loopBraceDepths = [];
    for (const line of lines) {
      if (loopPattern.test(line)) {
        loopBraceDepths.push(braceDepth);
        loopDepth = loopBraceDepths.filter(d => d >= braceDepth - 1).length;
        if (loopDepth > maxLoopDepth) maxLoopDepth = loopDepth;
      }
      const opens = (line.match(braceOpen) || []).length;
      const closes = (line.match(braceClose) || []).length;
      braceDepth += opens - closes;
      if (braceDepth < 0) braceDepth = 0;
    }
  }

  if (maxLoopDepth >= 2) {
    warnings.push(
      `NESTED LOOPS (depth ${maxLoopDepth}): O(n^${maxLoopDepth}) complexity. ` +
      `Extract inner loop to helper or use pipeline (flatMap/filter/LINQ).`
    );
  }

  // 2. Switch case count
  const caseCount = (content.match(/\bcase\s+/g) || []).length;
  if (caseCount >= 7) {
    warnings.push(
      `SWITCH ${caseCount} cases: use lookup table/registry or Strategy pattern.`
    );
  }

  return warnings;
}

// ============================================================
// (E) Compact Language Rules — Key rules in 1 line per language
// ============================================================

const COMPACT_RULES = {
  cpp:        'C/C++: RAII (unique_ptr), no raw new/delete. ranges/algorithms over raw loops. enum class, constexpr. MISRA if safety-critical.',
  csharp:     'C#: Primary constructors + DI. [ObservableProperty]/[RelayCommand] for WPF. ErrorOr<T> for errors. switch expression over if chains.',
  typescript: 'TS: satisfies for type narrowing. Discriminated unions for variants. Result<T,E> for errors. Record<K,V> as lookup table.',
  python:     'Python: Protocol over ABC. match statement for dispatch. dataclass(frozen=True) for value objects. TaskGroup over gather.',
  c:          'C: MISRA C:2012 Required rules. volatile for HW registers. static for file-scope. sizeof(*ptr) idiom. No dynamic alloc in embedded.',
};

const LANG_MAP = {
  '.c': 'c', '.h': 'c',
  '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp',
  '.cs': 'csharp',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'typescript', '.jsx': 'typescript',
  '.py': 'python',
};

/**
 * Get compact language-specific rules (1 line)
 * @param {string} filePath
 * @returns {string|null}
 */
function getCompactLangRules(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const lang = LANG_MAP[ext];
  if (!lang) return null;

  const refFile = lang === 'c' ? 'cpp' : lang;
  return COMPACT_RULES[lang] + ` Detail: Read refs/code-quality/${refFile}.md if needed.`;
}

// ============================================================
// (F) Existing Pattern Detection — Consistency enforcement
// ============================================================

/**
 * Detect patterns already in use in existing file
 * @param {string} filePath
 * @returns {string|null}
 */
function detectExistingPattern(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const existing = fs.readFileSync(filePath, 'utf-8');
    const patterns = [];

    if (existing.match(/constructor\s*\(.*(?:private|readonly)/)) patterns.push('DI');
    if (existing.match(/IRepository|Repository</)) patterns.push('Repository');
    if (existing.match(/ObservableObject|ObservableProperty|RelayCommand/)) patterns.push('MVVM(CommunityToolkit)');
    if (existing.match(/Strategy|Handler.*interface|IHandler/)) patterns.push('Strategy');
    if (existing.match(/Factory|create\w+\s*\(/)) patterns.push('Factory');
    if (existing.match(/EventEmitter|EventHandler|IObserver/)) patterns.push('Observer');

    return patterns.length > 0
      ? `Existing patterns: ${patterns.join(', ')}. Maintain consistency.`
      : null;
  } catch {
    return null;
  }
}

// ============================================================
// Main Entry Point
// ============================================================

/**
 * Generate contextual structural guide for pre-write injection.
 * Returns null if no guidance needed (e.g., tiny util file, no issues detected).
 *
 * @param {string} filePath - target file path
 * @param {string|null} content - content being written (may be null for some hooks)
 * @returns {string|null} guide string for PreToolUse context, or null
 */
function generateStructuralGuide(filePath, content) {
  const parts = [];

  // (A) Layer detection
  const layer = detectLayer(filePath);
  if (layer) {
    parts.push(LAYER_RULES[layer]);
  }

  // (B) Anti-pattern detection
  const antiPatterns = detectAntiPatterns(filePath, content);
  parts.push(...antiPatterns);

  // (C) Design pattern suggestions
  if (content) {
    const patternAdvice = suggestDesignPattern(content, filePath);
    parts.push(...patternAdvice);
  }

  // (D) Structural risks (loops/branches)
  if (content) {
    const risks = analyzeStructuralRisks(content, filePath);
    parts.push(...risks);
  }

  // (E) Language-specific compact rules
  const langRules = getCompactLangRules(filePath);
  if (langRules) parts.push(langRules);

  // (F) Existing pattern consistency
  const existingPattern = detectExistingPattern(filePath);
  if (existingPattern) parts.push(existingPattern);

  // Base sizing rules (always present for code files)
  parts.push('SIZING: Functions<=40 lines, params<=3, nesting<=3. Single responsibility.');

  return parts.length > 1 ? parts.join(' | ') : parts[0] || null;
}

module.exports = {
  generateStructuralGuide,
  detectLayer,
  detectAntiPatterns,
  suggestDesignPattern,
  analyzeStructuralRisks,
  getCompactLangRules,
  detectExistingPattern,
  // Exported for testing
  LAYER_PATTERNS,
  LAYER_RULES,
  COMPACT_RULES,
  countPublicMethods,
};
