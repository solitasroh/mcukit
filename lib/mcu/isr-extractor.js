/**
 * ISR Handler & NVIC Configuration Extractor
 * @module lib/mcu/isr-extractor
 * @version 0.1.0
 *
 * Extracts ISR handler functions, NVIC priority configurations,
 * ISR call graphs, and ISR global variable access from MCU source code.
 *
 * Supports: STM32 (CMSIS IRQHandler), NXP (FSL IRQHandler), generic patterns
 */

const fs = require('fs');
const path = require('path');

/** File extensions to scan */
const C_EXTENSIONS = ['.c', '.h', '.cpp', '.hpp'];

/** ISR handler name patterns (CMSIS standard + common variants) */
const ISR_PATTERNS = [
  /void\s+(\w+_IRQHandler)\s*\(\s*void\s*\)/g,
  /void\s+(SysTick_Handler)\s*\(\s*void\s*\)/g,
  /void\s+(PendSV_Handler)\s*\(\s*void\s*\)/g,
  /void\s+(SVC_Handler)\s*\(\s*void\s*\)/g,
  /void\s+(NMI_Handler)\s*\(\s*void\s*\)/g,
  /void\s+(HardFault_Handler)\s*\(\s*void\s*\)/g,
  /void\s+(MemManage_Handler)\s*\(\s*void\s*\)/g,
  /void\s+(BusFault_Handler)\s*\(\s*void\s*\)/g,
  /void\s+(UsageFault_Handler)\s*\(\s*void\s*\)/g,
];

/**
 * Recursively collect C source files from directory
 * @param {string} dir
 * @returns {string[]}
 */
function collectSourceFiles(dir) {
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...collectSourceFiles(fullPath));
      } else if (entry.isFile() && C_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Skip inaccessible directories
  }
  return files;
}

/**
 * Extract function body text given function declaration position
 * Tracks brace nesting to find the complete body.
 * @param {string} content - file content
 * @param {number} declEnd - index after the closing ')' of declaration
 * @returns {{body: string, startLine: number, endLine: number}|null}
 */
function extractFunctionBody(content, declEnd) {
  let idx = declEnd;
  // Skip whitespace and find opening brace
  while (idx < content.length && content[idx] !== '{') {
    if (content[idx] === ';') return null; // forward declaration
    idx++;
  }
  if (idx >= content.length) return null;

  const bodyStart = idx;
  let depth = 0;
  for (let i = idx; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        const body = content.substring(bodyStart, i + 1);
        const startLine = content.substring(0, bodyStart).split('\n').length;
        const endLine = content.substring(0, i + 1).split('\n').length;
        return { body, startLine, endLine };
      }
    }
  }
  return null;
}

/**
 * Extract ISR handler functions from source directory
 * @param {string} srcDir - source directory path
 * @returns {Array<{name: string, file: string, line: number, body: string}>}
 */
function extractISRHandlers(srcDir) {
  const sourceFiles = collectSourceFiles(srcDir);
  const handlers = [];
  const seen = new Set();

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');

    for (const pattern of ISR_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        if (seen.has(name)) continue;

        const line = content.substring(0, match.index).split('\n').length;
        const declEnd = match.index + match[0].length;
        const bodyInfo = extractFunctionBody(content, declEnd);

        if (bodyInfo) {
          seen.add(name);
          handlers.push({
            name,
            file: path.relative(srcDir, filePath),
            line,
            body: bodyInfo.body,
          });
        }
      }
    }
  }

  return handlers;
}

/**
 * Extract NVIC priority configuration from .ioc and source files
 * @param {string|null} iocPath - .ioc file path (null to skip)
 * @param {string} srcDir - source directory
 * @returns {Array<{irqName: string, preemptPriority: number, subPriority: number, source: string, file: string, line: number}>}
 */
function extractNVICConfig(iocPath, srcDir) {
  const configs = [];

  // 1. Extract from .ioc file
  if (iocPath && fs.existsSync(iocPath)) {
    const content = fs.readFileSync(iocPath, 'utf-8');
    const nvicEntries = new Map();

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // NVIC.{IRQ_NAME}.{Property}={Value}
      const nvicMatch = trimmed.match(/^NVIC\.(\w+)\.(PreemptionPriority|SubPriority)=(\d+)/);
      if (nvicMatch) {
        const [, irqName, prop, val] = nvicMatch;
        if (!nvicEntries.has(irqName)) {
          nvicEntries.set(irqName, { irqName, preemptPriority: 0, subPriority: 0 });
        }
        const entry = nvicEntries.get(irqName);
        if (prop === 'PreemptionPriority') entry.preemptPriority = parseInt(val, 10);
        else entry.subPriority = parseInt(val, 10);
      }
    }

    for (const entry of nvicEntries.values()) {
      configs.push({
        ...entry,
        source: 'ioc',
        file: path.relative(srcDir, iocPath),
        line: 0,
      });
    }
  }

  // 2. Extract from source: HAL_NVIC_SetPriority(IRQn, preempt, sub)
  const sourceFiles = collectSourceFiles(srcDir);
  const nvicPattern = /HAL_NVIC_SetPriority\s*\(\s*(\w+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    nvicPattern.lastIndex = 0;
    let match;
    while ((match = nvicPattern.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      configs.push({
        irqName: match[1],
        preemptPriority: parseInt(match[2], 10),
        subPriority: parseInt(match[3], 10),
        source: 'source',
        file: path.relative(srcDir, filePath),
        line,
      });
    }
  }

  return configs;
}

/**
 * Extract 1-depth call graph from ISR handlers
 * @param {string} srcDir - source directory
 * @param {Array<{name: string, body: string}>} handlers - extractISRHandlers result
 * @returns {Array<{handler: string, calledFunctions: Array<{name: string, line: number}>}>}
 */
function extractISRCallGraph(srcDir, handlers) {
  // Pattern: function call identifier( — exclude keywords and types
  const keywords = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return',
    'sizeof', 'typeof', 'void', 'int', 'char', 'uint8_t', 'uint16_t',
    'uint32_t', 'uint64_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t',
    'float', 'double', 'bool', 'struct', 'enum', 'union', 'typedef',
  ]);

  const callPattern = /\b([a-zA-Z_]\w*)\s*\(/g;

  return handlers.map(handler => {
    const calls = [];
    const seen = new Set();
    callPattern.lastIndex = 0;

    let match;
    while ((match = callPattern.exec(handler.body)) !== null) {
      const funcName = match[1];
      if (!keywords.has(funcName) && funcName !== handler.name && !seen.has(funcName)) {
        seen.add(funcName);
        const lineInBody = handler.body.substring(0, match.index).split('\n').length;
        calls.push({ name: funcName, line: handler.line + lineInBody - 1 });
      }
    }

    return {
      handler: handler.name,
      calledFunctions: calls,
    };
  });
}

/**
 * Extract global variable access from ISR handlers
 * @param {string} srcDir - source directory
 * @param {Array<{name: string, body: string, file: string}>} handlers - extractISRHandlers result
 * @returns {Array<{handler: string, variable: string, accessType: string, file: string, line: number}>}
 */
function extractISRGlobalAccess(srcDir, handlers) {
  // First, collect all file-scope global variable names
  const globalVars = new Set();
  const sourceFiles = collectSourceFiles(srcDir);
  const globalDeclPattern = /^(?:volatile\s+)?(?:static\s+)?(?:volatile\s+)?(?:extern\s+)?(?:const\s+)?(?:unsigned\s+)?(?:signed\s+)?(?:uint\d+_t|int\d+_t|u?int|char|float|double|bool|_Bool|size_t|ssize_t|\w+_t)\s+(\w+)\s*[=;[\]]/;

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let braceDepth = 0;

    for (const line of lines) {
      // Track brace depth — only consider file-scope (depth 0)
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
      }

      if (braceDepth === 0) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
        const match = trimmed.match(globalDeclPattern);
        if (match && match[1]) {
          globalVars.add(match[1]);
        }
      }
    }
  }

  // Now find which global vars are accessed in ISR bodies
  const accesses = [];

  for (const handler of handlers) {
    for (const varName of globalVars) {
      // Check if variable name appears in ISR body (word boundary)
      const varPattern = new RegExp(`\\b${varName}\\b`, 'g');
      let match;
      while ((match = varPattern.exec(handler.body)) !== null) {
        // Determine access type by looking at surrounding context
        const before = handler.body.substring(Math.max(0, match.index - 20), match.index);
        const after = handler.body.substring(match.index + varName.length, match.index + varName.length + 10);

        let accessType = 'read';
        if (after.match(/^\s*[+\-*\/|&^]?=/) || after.match(/^\s*\+\+/) || after.match(/^\s*--/)) {
          accessType = 'write';
        } else if (before.match(/\+\+\s*$/) || before.match(/--\s*$/)) {
          accessType = 'write';
        }

        const lineInBody = handler.body.substring(0, match.index).split('\n').length;
        accesses.push({
          handler: handler.name,
          variable: varName,
          accessType,
          file: handler.file,
          line: handler.line + lineInBody - 1,
        });
        break; // one entry per variable per handler
      }
    }
  }

  return accesses;
}

module.exports = {
  extractISRHandlers,
  extractNVICConfig,
  extractISRCallGraph,
  extractISRGlobalAccess,
  collectSourceFiles,
};
