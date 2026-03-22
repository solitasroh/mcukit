#!/usr/bin/env node
/**
 * Blast Radius Analyzer (FR-10)
 * Analyzes change impact scope using 6 rules (B-001 to B-006).
 *
 * Provides risk assessment and recommendations for large or high-impact changes.
 *
 * @version 2.0.0
 * @module lib/control/blast-radius
 */

const path = require('path');

/**
 * @typedef {'low'|'medium'|'high'|'critical'} RiskLevel
 */

/**
 * @typedef {Object} BlastRadiusResult
 * @property {RiskLevel} level - Overall risk level
 * @property {Array<{id: string, name: string, severity: string, details: string}>} rules - Triggered rules
 * @property {string} recommendation - Human-readable recommendation
 */

/**
 * Blast radius rules
 * @type {Object<string, {name: string, severity: RiskLevel, check: Function}>}
 */
const BLAST_RULES = {
  'B-001': {
    name: 'Large single file change',
    severity: 'medium',
    description: 'Single file change > 500 lines'
  },
  'B-002': {
    name: 'Many files changed simultaneously',
    severity: 'high',
    description: '10+ files changed simultaneously'
  },
  'B-003': {
    name: 'Mass file creation',
    severity: 'high',
    description: '20+ new files in session'
  },
  'B-004': {
    name: 'Dependency change',
    severity: 'high',
    description: 'package.json/dependencies change'
  },
  'B-005': {
    name: 'Database migration/schema change',
    severity: 'critical',
    description: 'DB migration or schema file change'
  },
  'B-006': {
    name: 'Config/settings file change',
    severity: 'medium',
    description: 'Configuration or settings file change'
  }
};

/** Patterns for dependency files (B-004) */
const DEPENDENCY_PATTERNS = [
  /package\.json$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /Gemfile(\.lock)?$/,
  /requirements\.txt$/,
  /go\.mod$/,
  /go\.sum$/,
  /Cargo\.(toml|lock)$/,
  /pyproject\.toml$/
];

/** Patterns for migration/schema files (B-005) */
const MIGRATION_PATTERNS = [
  /migration/i,
  /migrate/i,
  /schema\.(sql|prisma|graphql|ts|js)$/i,
  /\.sql$/,
  /prisma\/schema\.prisma$/
];

/** Patterns for config files (B-006) */
const CONFIG_PATTERNS = [
  /\.config\.(js|ts|json|yaml|yml)$/,
  /tsconfig.*\.json$/,
  /\.eslintrc/,
  /\.prettierrc/,
  /webpack\./,
  /vite\.config/,
  /next\.config/,
  /mcukit\.config\.json$/,
  /\.babelrc/,
  /jest\.config/,
  /docker-compose/,
  /Dockerfile/
];

/**
 * Analyze the blast radius of a set of changes
 * @param {string[]} changedFiles - Array of changed file paths
 * @param {Object} [changeStats] - Optional change statistics
 * @param {number} [changeStats.totalLinesChanged] - Total lines changed across all files
 * @param {Object<string, number>} [changeStats.linesPerFile] - Lines changed per file
 * @param {number} [changeStats.newFilesInSession] - Total new files created in current session
 * @returns {BlastRadiusResult}
 */
function analyzeBlastRadius(changedFiles, changeStats = {}) {
  const triggeredRules = [];
  const files = changedFiles || [];
  const linesPerFile = changeStats.linesPerFile || {};
  const newFilesInSession = changeStats.newFilesInSession || 0;

  // B-001: Single file > 500 lines
  for (const [filePath, lines] of Object.entries(linesPerFile)) {
    if (lines > 500) {
      triggeredRules.push({
        id: 'B-001',
        name: BLAST_RULES['B-001'].name,
        severity: BLAST_RULES['B-001'].severity,
        details: `${filePath}: ${lines} lines changed (threshold: 500)`
      });
    }
  }

  // B-002: 10+ files changed
  if (files.length >= 10) {
    triggeredRules.push({
      id: 'B-002',
      name: BLAST_RULES['B-002'].name,
      severity: BLAST_RULES['B-002'].severity,
      details: `${files.length} files changed simultaneously (threshold: 10)`
    });
  }

  // B-003: 20+ new files in session
  if (newFilesInSession >= 20) {
    triggeredRules.push({
      id: 'B-003',
      name: BLAST_RULES['B-003'].name,
      severity: BLAST_RULES['B-003'].severity,
      details: `${newFilesInSession} new files created in session (threshold: 20)`
    });
  }

  // B-004: Dependency file change
  for (const filePath of files) {
    const basename = path.basename(filePath);
    if (DEPENDENCY_PATTERNS.some(p => p.test(filePath) || p.test(basename))) {
      triggeredRules.push({
        id: 'B-004',
        name: BLAST_RULES['B-004'].name,
        severity: BLAST_RULES['B-004'].severity,
        details: `Dependency file changed: ${filePath}`
      });
      break; // One trigger is enough
    }
  }

  // B-005: Migration/schema change
  for (const filePath of files) {
    if (MIGRATION_PATTERNS.some(p => p.test(filePath))) {
      triggeredRules.push({
        id: 'B-005',
        name: BLAST_RULES['B-005'].name,
        severity: BLAST_RULES['B-005'].severity,
        details: `Database migration/schema file changed: ${filePath}`
      });
      break;
    }
  }

  // B-006: Config/settings change
  for (const filePath of files) {
    const basename = path.basename(filePath);
    if (CONFIG_PATTERNS.some(p => p.test(filePath) || p.test(basename))) {
      triggeredRules.push({
        id: 'B-006',
        name: BLAST_RULES['B-006'].name,
        severity: BLAST_RULES['B-006'].severity,
        details: `Config/settings file changed: ${filePath}`
      });
      break;
    }
  }

  // Determine overall level
  const level = determineLevel(triggeredRules);
  const recommendation = buildRecommendation(level, triggeredRules);

  return { level, rules: triggeredRules, recommendation };
}

/**
 * Check a single file for blast radius warnings
 * @param {string} filePath - File path
 * @param {number} linesChanged - Number of lines changed
 * @returns {{warning: boolean, rule: string|null}}
 */
function checkSingleFile(filePath, linesChanged) {
  if (linesChanged > 500) {
    return { warning: true, rule: 'B-001: Large single file change — consider splitting into smaller changes' };
  }

  if (MIGRATION_PATTERNS.some(p => p.test(filePath))) {
    return { warning: true, rule: 'B-005: Database migration/schema change — create checkpoint before proceeding' };
  }

  if (CONFIG_PATTERNS.some(p => p.test(filePath) || p.test(path.basename(filePath)))) {
    return { warning: true, rule: 'B-006: Config/settings file change — verify scope of impact' };
  }

  if (DEPENDENCY_PATTERNS.some(p => p.test(filePath) || p.test(path.basename(filePath)))) {
    return { warning: true, rule: 'B-004: Dependency change — run impact analysis' };
  }

  return { warning: false, rule: null };
}

/**
 * Check session-level scope for blast radius warnings
 * @param {Object} sessionStats - Session statistics
 * @param {number} [sessionStats.filesChanged=0] - Total files changed in session
 * @param {number} [sessionStats.newFiles=0] - Total new files created
 * @param {number} [sessionStats.totalLinesChanged=0] - Total lines changed
 * @returns {{warning: boolean, details: string}}
 */
function checkSessionScope(sessionStats = {}) {
  const { filesChanged = 0, newFiles = 0, totalLinesChanged = 0 } = sessionStats;
  const warnings = [];

  if (filesChanged >= 10) {
    warnings.push(`${filesChanged} files changed (B-002: recommend step-by-step approach)`);
  }
  if (newFiles >= 20) {
    warnings.push(`${newFiles} new files created (B-003: requires approval)`);
  }
  if (totalLinesChanged > 2000) {
    warnings.push(`${totalLinesChanged} total lines changed (recommend checkpoint)`);
  }

  return {
    warning: warnings.length > 0,
    details: warnings.length > 0
      ? `Session scope warnings:\n  - ${warnings.join('\n  - ')}`
      : 'Session scope within normal limits.'
  };
}

/**
 * Determine the overall risk level from triggered rules
 * @param {Array<{severity: string}>} rules - Triggered rules
 * @returns {RiskLevel}
 */
function determineLevel(rules) {
  if (rules.length === 0) return 'low';
  if (rules.some(r => r.severity === 'critical')) return 'critical';
  if (rules.some(r => r.severity === 'high')) return 'high';
  if (rules.some(r => r.severity === 'medium')) return 'medium';
  return 'low';
}

/**
 * Build a human-readable recommendation string
 * @param {RiskLevel} level - Risk level
 * @param {Array} rules - Triggered rules
 * @returns {string}
 */
function buildRecommendation(level, rules) {
  if (rules.length === 0) {
    return 'Changes are within acceptable blast radius. Proceed normally.';
  }

  const recs = [];
  if (level === 'critical') {
    recs.push('CRITICAL: Create a checkpoint before proceeding.');
    recs.push('Consider breaking this change into smaller, incremental steps.');
  } else if (level === 'high') {
    recs.push('HIGH: Review all changes carefully before committing.');
    recs.push('Recommended: create a checkpoint and proceed step-by-step.');
  } else {
    recs.push('MEDIUM: Minor blast radius concerns detected.');
  }

  for (const rule of rules) {
    recs.push(`  [${rule.id}] ${rule.details}`);
  }

  return recs.join('\n');
}

module.exports = {
  analyzeBlastRadius,
  checkSingleFile,
  checkSessionScope,
  BLAST_RULES
};
