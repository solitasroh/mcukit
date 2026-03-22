/**
 * Do Phase Completion 3-Layer Detection
 * @module lib/pdca/do-detector
 * @version 2.0.0
 *
 * Detects Do phase completion through 3 layers:
 * Layer 1 (Explicit): Pattern matching user messages for completion keywords
 * Layer 2 (Implicit): Compare design doc file list vs actual files
 * Layer 3 (Confirmation): Generate AskUserQuestion prompt for user confirmation
 */

const fs = require('fs');
const path = require('path');

// Lazy requires
let _core = null;
function getCore() {
  if (!_core) { _core = require('../core'); }
  return _core;
}

let _phase = null;
function getPhase() {
  if (!_phase) { _phase = require('./phase'); }
  return _phase;
}

/**
 * Explicit completion declaration patterns (multilingual)
 * @type {RegExp[]}
 */
const EXPLICIT_PATTERNS = [
  // Task subject patterns
  /\[Do\]\s+.+/i,
  /\[Implementation\]\s+.+/i,
  // Completion declaration patterns (multilingual)
  /구현\s*(이\s*)?완료/,
  /implementation\s+complete/i,
  /coding\s+done/i,
  /do\s+phase\s+complete/i,
  /all\s+files?\s+(?:created|implemented)/i,
  /ready\s+for\s+(?:review|analysis|check)/i,
  // /pdca command patterns
  /\/pdca\s+(?:analyze|check)\s+/i,
  // Simple keywords
  /\bcomplete\b/i,
  /\bdone\b/i,
  /\b완료\b/,
];

/**
 * File path extraction patterns for design documents
 * @type {RegExp[]}
 */
const FILE_PATH_PATTERNS = [
  /`([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)`/g,
  /[├└│─]\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)/g,
  /\|\s*`?([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)`?\s*\|/g,
];

/**
 * Patterns to ignore when comparing design files (docs, configs, tests)
 * @type {RegExp[]}
 */
const IGNORE_PATTERNS = [
  /\.md$/,
  /\.json$/,
  /test.*\./,
  /\.env/,
];

/**
 * Detect Layer 1: Explicit completion declaration via pattern matching
 * @param {Object} [signals] - External signals
 * @param {string} [signals.taskSubject] - TaskCompleted subject
 * @param {string} [signals.userMessage] - User message text
 * @param {string} [signals.toolResult] - Tool execution result
 * @returns {{ matched: boolean, matchedPattern: string|null, source: string|null }}
 */
function detectExplicit(signals = {}) {
  const sources = [
    { text: signals.taskSubject, source: 'task_subject' },
    { text: signals.userMessage, source: 'user_message' },
    { text: signals.toolResult, source: 'tool_result' },
  ];

  for (const { text, source } of sources) {
    if (!text) continue;
    for (const pattern of EXPLICIT_PATTERNS) {
      if (pattern.test(text)) {
        return { matched: true, matchedPattern: pattern.source, source };
      }
    }
  }

  return { matched: false, matchedPattern: null, source: null };
}

/**
 * Extract implementation target file list from design document
 * @param {string} feature - Feature name
 * @returns {string[]} List of file paths found in design doc
 */
function extractDesignFiles(feature) {
  const { findDesignDoc } = getPhase();
  const designPath = findDesignDoc(feature);
  if (!designPath) return [];

  let content;
  try {
    content = fs.readFileSync(designPath, 'utf8');
  } catch (e) {
    return [];
  }

  const files = new Set();

  for (const pattern of FILE_PATH_PATTERNS) {
    // Reset regex state for global patterns
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const filePath = match[1];
      // Skip files matching ignore patterns
      const shouldIgnore = IGNORE_PATTERNS.some(ip => ip.test(filePath));
      if (!shouldIgnore && filePath.includes('/')) {
        files.add(filePath);
      }
    }
  }

  return Array.from(files);
}

/**
 * Calculate completion rate by comparing design files vs existing files
 * @param {string[]} designFiles - Files defined in design document
 * @param {string[]} existingFiles - Files that actually exist
 * @returns {number} Completion rate 0-100
 */
function calculateCompletionRate(designFiles, existingFiles) {
  if (!designFiles.length) return 0;
  const existingSet = new Set(existingFiles);
  const found = designFiles.filter(f => existingSet.has(f));
  return Math.round((found.length / designFiles.length) * 100);
}

/**
 * Detect Layer 2: Implicit completion via design doc vs filesystem comparison
 * @param {string} feature - Feature name
 * @returns {{ totalFiles: number, existingFiles: number, completionRate: number, missingFiles: string[], foundFiles: string[] }}
 */
function detectImplicit(feature) {
  const { PROJECT_DIR } = getCore();
  const designFiles = extractDesignFiles(feature);

  if (!designFiles.length) {
    return { totalFiles: 0, existingFiles: 0, completionRate: 0, missingFiles: [], foundFiles: [] };
  }

  const foundFiles = [];
  const missingFiles = [];

  for (const filePath of designFiles) {
    const fullPath = path.join(PROJECT_DIR, filePath);
    if (fs.existsSync(fullPath)) {
      foundFiles.push(filePath);
    } else {
      missingFiles.push(filePath);
    }
  }

  const completionRate = calculateCompletionRate(designFiles, foundFiles);

  return {
    totalFiles: designFiles.length,
    existingFiles: foundFiles.length,
    completionRate,
    missingFiles,
    foundFiles,
  };
}

/**
 * Detect Do phase completion using 3-Layer sequential detection
 * Layer 1: Explicit pattern matching (confidence 1.0)
 * Layer 2: Implicit file comparison (confidence based on rate)
 * Layer 3: User confirmation needed (confidence 0.5)
 *
 * @param {string} feature - Feature name
 * @param {Object} [signals] - External signals
 * @param {string} [signals.taskSubject] - TaskCompleted subject
 * @param {string} [signals.userMessage] - User message text
 * @param {string} [signals.toolResult] - Tool execution result
 * @returns {{ complete: boolean, detectedLayer: 1|2|3, confidence: number, reason: string, detail: Object }}
 */
function detectDoCompletion(feature, signals = {}) {
  const { debugLog } = getCore();

  // Layer 1: Explicit completion declaration
  const explicit = detectExplicit(signals);
  if (explicit.matched) {
    debugLog('PDCA', 'Do completion detected (Layer 1: Explicit)', { feature, source: explicit.source });
    return {
      complete: true,
      detectedLayer: 1,
      confidence: 1.0,
      reason: `Explicit completion detected from ${explicit.source}: ${explicit.matchedPattern}`,
      detail: { explicit, implicit: null, userConfirm: null },
    };
  }

  // Layer 2: Implicit completion via file comparison
  const implicit = detectImplicit(feature);
  if (implicit.totalFiles > 0 && implicit.completionRate >= 80) {
    debugLog('PDCA', 'Do completion detected (Layer 2: Implicit)', {
      feature, rate: implicit.completionRate,
    });
    return {
      complete: true,
      detectedLayer: 2,
      confidence: implicit.completionRate / 100,
      reason: `Implicit completion: ${implicit.completionRate}% of design files exist (${implicit.existingFiles}/${implicit.totalFiles})`,
      detail: { explicit: null, implicit, userConfirm: null },
    };
  }

  // Layer 3: User confirmation needed
  debugLog('PDCA', 'Do completion undetermined, Layer 3 confirmation needed', { feature });
  return {
    complete: false,
    detectedLayer: 3,
    confidence: 0.5,
    reason: implicit.totalFiles > 0
      ? `Implementation ${implicit.completionRate}% complete (${implicit.existingFiles}/${implicit.totalFiles} files). User confirmation needed.`
      : 'Cannot determine completion automatically. User confirmation needed.',
    detail: {
      explicit: null,
      implicit: implicit.totalFiles > 0 ? implicit : null,
      userConfirm: { userResponse: 'pending', respondedAt: null },
    },
  };
}

module.exports = {
  detectDoCompletion,
  detectExplicit,
  detectImplicit,
  extractDesignFiles,
  calculateCompletionRate,
  EXPLICIT_PATTERNS,
};
