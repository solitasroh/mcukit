/**
 * Design Rules — L1 Universal Code Quality Rules
 * @module lib/code-quality/design-rules
 * @version 0.1.0
 *
 * Defines the L1 (Layer 1) rule catalog for domain-agnostic code design quality.
 * Used by the code-analyzer agent and review-orchestrator.
 *
 * Quantitative checks (function length, nesting, etc.) are implemented in
 * metrics-collector.js. This module defines the *rule catalog* (descriptions,
 * severity mappings, category taxonomy, LLM evaluation prompts) used for
 * qualitative analysis and report generation.
 *
 * Layer boundaries:
 *   L1 (this module) — SOLID, DRY, complexity, naming, anti-patterns (domain-agnostic)
 *   L2              — Language idioms (C/C++, C#, Python)
 *   L3              — Domain safety (MISRA, ISR/DMA, MVVM) delegated to existing agents
 */

/**
 * Severity taxonomy (aligned with refs/code-quality/common.md Section 10).
 *
 * Maps to review actions:
 *   CRITICAL -> BLOCK (deployment halted)
 *   HIGH     -> WARNING (review cannot pass)
 *   MEDIUM   -> WARNING (review can pass)
 *   LOW      -> APPROVE (informational)
 */
const SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH:     'HIGH',
  MEDIUM:   'MEDIUM',
  LOW:      'LOW',
});

/**
 * Review action derived from severity.
 * @param {string} severity
 * @returns {'BLOCK' | 'WARNING' | 'APPROVE'}
 */
function severityToAction(severity) {
  switch (severity) {
    case SEVERITY.CRITICAL: return 'BLOCK';
    case SEVERITY.HIGH:
    case SEVERITY.MEDIUM:   return 'WARNING';
    case SEVERITY.LOW:      return 'APPROVE';
    default:                return 'WARNING';
  }
}

/**
 * Rule categories for L1 layer.
 * Each rule belongs to exactly one category for reporting.
 */
const CATEGORY = Object.freeze({
  STRUCTURE:     'structure',      // SQ-001~004: sizing limits
  COMPLEXITY:    'complexity',     // SQ-005~006b: structural complexity
  COHESION:      'cohesion',       // SQ-007: God class, SRP
  ARCHITECTURE:  'architecture',   // SQ-008: layer dependencies
  SOLID:         'solid',          // SOLID principles beyond SRP
  DRY:           'dry',            // Code duplication
  NAMING:        'naming',         // Naming conventions, magic numbers
  ANTI_PATTERN:  'anti-pattern',   // Feature Envy, Primitive Obsession, etc.
});

/**
 * L1 rule catalog.
 *
 * Each rule is the single source of truth for its id, category, default
 * severity, and review guidance. Metrics-collector.js produces violations
 * with the rule id; this catalog supplies the human-readable context.
 *
 * Structure:
 *   id         — Stable rule identifier (SQ-xxx or SOLID-xxx etc.)
 *   category   — One of CATEGORY
 *   severity   — Default severity (can be overridden by metric thresholds)
 *   title      — Short rule name
 *   description — What the rule checks
 *   fix        — How to fix a violation
 *   detection  — 'quantitative' (metrics-collector) or 'qualitative' (LLM)
 */
const RULES = Object.freeze({
  // --- Structure (SQ-001 ~ SQ-004) ---
  'SQ-001': {
    id: 'SQ-001',
    category: CATEGORY.STRUCTURE,
    severity: SEVERITY.HIGH,
    title: 'Function length',
    description: 'Function exceeds line limit (warn: 40, error: 80). Long functions violate SRP and are hard to test.',
    fix: 'Extract cohesive blocks into helper functions. Each helper should do one thing.',
    detection: 'quantitative',
  },
  'SQ-002': {
    id: 'SQ-002',
    category: CATEGORY.STRUCTURE,
    severity: SEVERITY.MEDIUM,
    title: 'Parameter count',
    description: 'Function has too many parameters (warn: 3, error: 5). Indicates Primitive Obsession or weak cohesion.',
    fix: 'Group related parameters into a Value Object or options struct.',
    detection: 'quantitative',
  },
  'SQ-003': {
    id: 'SQ-003',
    category: CATEGORY.COMPLEXITY,
    severity: SEVERITY.HIGH,
    title: 'Nesting depth',
    description: 'Function has excessive nesting (warn: 3, error: 5). Deep nesting hides control flow.',
    fix: 'Flatten with guard clauses (early return). Extract nested blocks into helpers.',
    detection: 'quantitative',
  },
  'SQ-004': {
    id: 'SQ-004',
    category: CATEGORY.STRUCTURE,
    severity: SEVERITY.MEDIUM,
    title: 'File length',
    description: 'File exceeds line limit (warn: 300, error: 500). Large files combine multiple concerns.',
    fix: 'Split file by responsibility. Extract cohesive groups into separate modules.',
    detection: 'quantitative',
  },

  // --- Complexity (SQ-005 ~ SQ-006b) ---
  'SQ-005': {
    id: 'SQ-005',
    category: CATEGORY.COMPLEXITY,
    severity: SEVERITY.HIGH,
    title: 'Nested loops',
    description: 'Nested loops exceed depth limit (warn: 2, error: 3). O(n^k) complexity hidden in loop nesting.',
    fix: 'Extract inner loop to helper, or use a pipeline (map/filter/reduce, SQL join, set intersection).',
    detection: 'quantitative',
  },
  'SQ-006': {
    id: 'SQ-006',
    category: CATEGORY.COMPLEXITY,
    severity: SEVERITY.MEDIUM,
    title: 'Branch chain (if/else-if)',
    description: 'Long if/else-if chain (warn: 5, error: 8). Adding new cases requires modifying existing code (OCP violation).',
    fix: 'Replace with Strategy pattern, lookup table, or polymorphic dispatch.',
    detection: 'quantitative',
  },
  'SQ-006b': {
    id: 'SQ-006b',
    category: CATEGORY.COMPLEXITY,
    severity: SEVERITY.MEDIUM,
    title: 'Switch cases',
    description: 'Switch with too many cases (warn: 8, error: 12). Often indicates type-based branching that should be polymorphic.',
    fix: 'Replace with lookup table, registry, or subtype polymorphism (dispatch by type).',
    detection: 'quantitative',
  },

  // --- Cohesion (SQ-007) ---
  'SQ-007': {
    id: 'SQ-007',
    category: CATEGORY.COHESION,
    severity: SEVERITY.HIGH,
    title: 'God Class signal',
    description: 'Class has 7+ public methods AND 300+ lines. Violates Single Responsibility Principle.',
    fix: 'Split by responsibility. Identify clusters of methods that operate on the same data and extract them.',
    detection: 'quantitative',
  },

  // --- Architecture (SQ-008) ---
  'SQ-008': {
    id: 'SQ-008',
    category: CATEGORY.ARCHITECTURE,
    severity: SEVERITY.HIGH,
    title: 'Architecture violation',
    description: 'Cross-layer import detected. Dependencies must point inward (Presentation → Application → Domain ← Infrastructure).',
    fix: 'Invert the dependency: define an interface in the inner layer, implement it in the outer layer.',
    detection: 'quantitative',
  },

  // --- SOLID (qualitative, LLM-evaluated) ---
  'SOLID-SRP': {
    id: 'SOLID-SRP',
    category: CATEGORY.SOLID,
    severity: SEVERITY.HIGH,
    title: 'Single Responsibility Principle violation',
    description: 'Class or function has more than one reason to change. Name contains "And"/"Or", or method list shows unrelated responsibilities.',
    fix: 'Split by reason-to-change. Each module should answer to a single stakeholder concern.',
    detection: 'qualitative',
  },
  'SOLID-OCP': {
    id: 'SOLID-OCP',
    category: CATEGORY.SOLID,
    severity: SEVERITY.MEDIUM,
    title: 'Open/Closed Principle violation',
    description: 'Adding a new variant requires modifying existing code (typically a long if/else-if or switch on type).',
    fix: 'Introduce abstraction (interface/strategy). New variants add a new class; existing code unchanged.',
    detection: 'qualitative',
  },
  'SOLID-LSP': {
    id: 'SOLID-LSP',
    category: CATEGORY.SOLID,
    severity: SEVERITY.HIGH,
    title: 'Liskov Substitution Principle violation',
    description: 'Subclass weakens preconditions, strengthens postconditions, or throws unexpected exceptions.',
    fix: 'Either: (a) subclass honors parent contract, or (b) composition instead of inheritance.',
    detection: 'qualitative',
  },
  'SOLID-ISP': {
    id: 'SOLID-ISP',
    category: CATEGORY.SOLID,
    severity: SEVERITY.MEDIUM,
    title: 'Interface Segregation Principle violation',
    description: 'Interface forces clients to depend on methods they do not use. Fat interface with unrelated concerns.',
    fix: 'Split into role-specific interfaces. Clients depend only on the minimal interface they need.',
    detection: 'qualitative',
  },
  'SOLID-DIP': {
    id: 'SOLID-DIP',
    category: CATEGORY.SOLID,
    severity: SEVERITY.HIGH,
    title: 'Dependency Inversion Principle violation',
    description: 'High-level module directly depends on a concrete low-level implementation (e.g., `new Database()` in business logic).',
    fix: 'Depend on an abstraction (interface/protocol). Inject the concrete implementation at composition root.',
    detection: 'qualitative',
  },

  // --- DRY ---
  'DRY-001': {
    id: 'DRY-001',
    category: CATEGORY.DRY,
    severity: SEVERITY.MEDIUM,
    title: 'Exact code duplication',
    description: 'Identical code block appears in 2+ locations (>=5 lines or >=3 statements).',
    fix: 'Extract to a shared function. If the duplication crosses layers, the function belongs in the lower layer.',
    detection: 'qualitative',
  },
  'DRY-002': {
    id: 'DRY-002',
    category: CATEGORY.DRY,
    severity: SEVERITY.LOW,
    title: 'Structural duplication',
    description: 'Similar structure with different data (e.g., three functions shaped `format<X>`). Repetition of pattern, not code.',
    fix: 'Parameterize the varying part. Use a higher-order function or template.',
    detection: 'qualitative',
  },

  // --- Naming ---
  'NAME-001': {
    id: 'NAME-001',
    category: CATEGORY.NAMING,
    severity: SEVERITY.LOW,
    title: 'Naming convention violation',
    description: 'Identifier does not follow project convention (camelCase/snake_case/PascalCase as appropriate to language).',
    fix: 'Rename to match the convention defined in refs/code-quality/{language}.md.',
    detection: 'qualitative',
  },
  'NAME-002': {
    id: 'NAME-002',
    category: CATEGORY.NAMING,
    severity: SEVERITY.MEDIUM,
    title: 'Magic number',
    description: 'Unnamed numeric literal (other than 0, 1, -1, 2) used in logic. Hides intent.',
    fix: 'Extract to a named constant with a descriptive name. Group related constants in an enum or module.',
    detection: 'qualitative',
  },
  'NAME-003': {
    id: 'NAME-003',
    category: CATEGORY.NAMING,
    severity: SEVERITY.LOW,
    title: 'Unclear identifier',
    description: 'Identifier is too short (< 3 chars, except loop counters) or too generic (`data`, `info`, `temp`, `tmp`, `obj`).',
    fix: 'Rename to describe the role. A reader should understand usage without consulting the definition.',
    detection: 'qualitative',
  },

  // --- Anti-patterns ---
  'AP-FEATURE-ENVY': {
    id: 'AP-FEATURE-ENVY',
    category: CATEGORY.ANTI_PATTERN,
    severity: SEVERITY.MEDIUM,
    title: 'Feature Envy',
    description: 'Method accesses 4+ fields or methods of another object more than its own. Indicates the method belongs elsewhere.',
    fix: 'Move the method to the class whose data it operates on.',
    detection: 'qualitative',
  },
  'AP-PRIMITIVE-OBSESSION': {
    id: 'AP-PRIMITIVE-OBSESSION',
    category: CATEGORY.ANTI_PATTERN,
    severity: SEVERITY.MEDIUM,
    title: 'Primitive Obsession',
    description: 'Passing 3+ primitives (string, int) together that always travel in a group. Missing domain type.',
    fix: 'Introduce a Value Object with validation in the constructor.',
    detection: 'qualitative',
  },
  'AP-DATA-CLUMP': {
    id: 'AP-DATA-CLUMP',
    category: CATEGORY.ANTI_PATTERN,
    severity: SEVERITY.LOW,
    title: 'Data Clump',
    description: 'Same group of fields appearing in multiple classes/functions. Indicates a missing abstraction.',
    fix: 'Extract the clump into a named type shared by both sites.',
    detection: 'qualitative',
  },
  'AP-LONG-PARAMETER-LIST': {
    id: 'AP-LONG-PARAMETER-LIST',
    category: CATEGORY.ANTI_PATTERN,
    severity: SEVERITY.MEDIUM,
    title: 'Long Parameter List',
    description: 'Constructor or function takes 4+ parameters. Overlaps with SQ-002 but focuses on construction sites.',
    fix: 'Introduce a Builder, parameter object, or use named parameters.',
    detection: 'qualitative',
  },
  'AP-SHOTGUN-SURGERY': {
    id: 'AP-SHOTGUN-SURGERY',
    category: CATEGORY.ANTI_PATTERN,
    severity: SEVERITY.HIGH,
    title: 'Shotgun Surgery',
    description: 'A single logical change requires edits in many unrelated files. Indicates missing abstraction or leaked concept.',
    fix: 'Consolidate the concept into one module. Use dependency inversion so others refer to the abstraction.',
    detection: 'qualitative',
  },
});

/**
 * Get rule by id.
 * @param {string} id
 * @returns {object|null}
 */
function getRule(id) {
  return RULES[id] || null;
}

/**
 * Get all rules in a category.
 * @param {string} category
 * @returns {object[]}
 */
function getRulesByCategory(category) {
  return Object.values(RULES).filter(r => r.category === category);
}

/**
 * Get all rules with a given detection method.
 * @param {'quantitative' | 'qualitative'} method
 * @returns {object[]}
 */
function getRulesByDetection(method) {
  return Object.values(RULES).filter(r => r.detection === method);
}

/**
 * Enrich a metrics-collector violation with rule catalog context.
 *
 * metrics-collector produces: { rule: 'SQ-001', message, line, severity: 'warning'|'error' }
 * This function maps to the unified severity taxonomy and adds fix guidance.
 *
 * @param {object} violation
 * @returns {object} enriched violation
 */
function enrichViolation(violation) {
  const rule = getRule(violation.rule);
  if (!rule) { return violation; }

  // Map metrics-collector 'warning'/'error' to unified taxonomy:
  // 'error' overrides the catalog default to CRITICAL only if the catalog says HIGH.
  // Keep the catalog severity as the baseline — metrics just flag hard-stop cases.
  let severity = rule.severity;
  if (violation.severity === 'error' && rule.severity === SEVERITY.HIGH) {
    severity = SEVERITY.CRITICAL;
  }

  return {
    ...violation,
    category: rule.category,
    severity,
    action: severityToAction(severity),
    title: rule.title,
    fix: rule.fix,
  };
}

module.exports = {
  SEVERITY,
  CATEGORY,
  RULES,
  getRule,
  getRulesByCategory,
  getRulesByDetection,
  enrichViolation,
  severityToAction,
};
