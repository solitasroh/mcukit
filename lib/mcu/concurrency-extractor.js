/**
 * Concurrency Hazard Data Extractor
 * @module lib/mcu/concurrency-extractor
 * @version 0.1.0
 *
 * Extracts global variables, synchronization primitives,
 * context switch points, and atomic operations from MCU source code.
 *
 * Supports configurable patterns for custom schedulers via options parameter.
 */

const fs = require('fs');
const path = require('path');
const { collectSourceFiles } = require('./isr-extractor');

/** Default synchronization primitive patterns */
const DEFAULT_SYNC_PATTERNS = [
  // Mutex
  { type: 'sync-enter', pattern: /\b(?:mutex_lock|osMutexAcquire|xSemaphoreTake|pthread_mutex_lock)\s*\(/g },
  { type: 'sync-exit', pattern: /\b(?:mutex_unlock|osMutexRelease|xSemaphoreGive|pthread_mutex_unlock)\s*\(/g },
  // Critical section
  { type: 'sync-enter', pattern: /\b(?:critical_enter|taskENTER_CRITICAL|vPortEnterCritical|EnterCriticalSection)\s*\(/g },
  { type: 'sync-exit', pattern: /\b(?:critical_exit|taskEXIT_CRITICAL|vPortExitCritical|LeaveCriticalSection)\s*\(/g },
  // Interrupt control
  { type: 'sync-enter', pattern: /\b(?:__disable_irq|__disable_fault_irq|irq_disable|portDISABLE_INTERRUPTS)\s*\(/g },
  { type: 'sync-exit', pattern: /\b(?:__enable_irq|__enable_fault_irq|irq_enable|portENABLE_INTERRUPTS)\s*\(/g },
  // HAL lock
  { type: 'sync-enter', pattern: /\b__HAL_LOCK\s*\(/g },
  { type: 'sync-exit', pattern: /\b__HAL_UNLOCK\s*\(/g },
  // Semaphore
  { type: 'sync-enter', pattern: /\b(?:sem_wait|osSemaphoreAcquire)\s*\(/g },
  { type: 'sync-exit', pattern: /\b(?:sem_post|osSemaphoreRelease)\s*\(/g },
];

/** Default context switch point patterns */
const DEFAULT_SWITCH_PATTERNS = [
  /\b(?:scheduler_yield|osThreadYield|taskYIELD|vTaskDelay|osDelay|scheduler_start)\s*\(/g,
  /\b(?:SVC_Handler|PendSV_Handler)\b/g,
];

/** C type keywords for global variable detection */
const C_TYPE_PATTERN = /^(?:extern\s+)?(?:static\s+)?(?:volatile\s+)?(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:uint\d+_t|int\d+_t|u?int|char|short|long|float|double|bool|_Bool|size_t|ssize_t|BaseType_t|TickType_t|EventBits_t|\w+_t)\b/;

/**
 * Extract global and file-scope static variables with volatile status
 * @param {string} srcDir - source directory
 * @returns {Array<{name: string, type: string, isVolatile: boolean, isStatic: boolean, file: string, line: number, accessPoints: Array}>}
 */
function extractGlobalVariables(srcDir) {
  const sourceFiles = collectSourceFiles(srcDir);
  const variables = [];
  const varDeclPattern = /^((?:extern\s+)?(?:static\s+)?(?:volatile\s+)?(?:const\s+)?(?:unsigned\s+|signed\s+)?(?:uint\d+_t|int\d+_t|u?int|char|short|long|float|double|bool|_Bool|size_t|\w+_t)(?:\s*\*)?)\s+(\w+)\s*(?:\[[\d\w]*\])?\s*[=;,]/;

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relPath = path.relative(srcDir, filePath);
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track brace depth
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
      }

      // Only consider file-scope (depth 0) declarations
      if (braceDepth !== 0) continue;

      const trimmed = line.trim();
      // Skip comments, preprocessor, typedefs, function declarations
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')
          || trimmed.startsWith('*') || trimmed.startsWith('#')
          || trimmed.startsWith('typedef') || trimmed.includes('(')) continue;

      // Check if line matches a type pattern
      if (!C_TYPE_PATTERN.test(trimmed)) continue;

      const match = trimmed.match(varDeclPattern);
      if (match) {
        const typeStr = match[1].trim();
        const name = match[2];

        // Skip common non-variable patterns
        if (['main', 'void', 'return'].includes(name)) continue;

        const isVolatile = typeStr.includes('volatile');
        const isStatic = typeStr.includes('static');
        const isExtern = typeStr.includes('extern');

        // Collect access points across all files
        const accessPoints = findAccessPoints(sourceFiles, srcDir, name);

        variables.push({
          name,
          type: typeStr.replace(/\s+/g, ' '),
          isVolatile,
          isStatic,
          isExtern,
          file: relPath,
          line: i + 1,
          accessPoints,
        });
      }
    }
  }

  return variables;
}

/**
 * Find all access points for a variable across source files
 * @param {string[]} sourceFiles
 * @param {string} srcDir
 * @param {string} varName
 * @returns {Array<{file: string, line: number, isWrite: boolean, context: string}>}
 */
function findAccessPoints(sourceFiles, srcDir, varName) {
  const accesses = [];
  const varPattern = new RegExp(`\\b${varName}\\b`, 'g');

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relPath = path.relative(srcDir, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip declarations, comments, preprocessor
      if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')
          || line.startsWith('#') || line.startsWith('typedef')
          || line.startsWith('extern')) continue;

      if (varPattern.test(line)) {
        varPattern.lastIndex = 0;
        // Determine if write
        const writePatterns = [
          new RegExp(`\\b${varName}\\s*[+\\-*\\/|&^]?=`),
          new RegExp(`\\+\\+\\s*${varName}\\b`),
          new RegExp(`\\b${varName}\\s*\\+\\+`),
          new RegExp(`--\\s*${varName}\\b`),
          new RegExp(`\\b${varName}\\s*--`),
        ];
        const isWrite = writePatterns.some(p => p.test(line));

        // Extract enclosing function name
        const context = findEnclosingFunction(content, i);

        accesses.push({
          file: relPath,
          line: i + 1,
          isWrite,
          context,
        });
      }
    }
  }

  return accesses;
}

/**
 * Find the function name enclosing a given line
 * @param {string} content
 * @param {number} targetLine - 0-based line index
 * @returns {string} function name or "file-scope"
 */
function findEnclosingFunction(content, targetLine) {
  const lines = content.split('\n');
  // Walk backwards to find function definition
  const funcPattern = /(?:void|int|uint\d+_t|char|bool|float|double|static\s+\w+|\w+_t)\s+(\w+)\s*\(/;

  let braceCount = 0;
  for (let i = targetLine; i >= 0; i--) {
    const line = lines[i];
    for (let j = line.length - 1; j >= 0; j--) {
      if (line[j] === '}') braceCount++;
      else if (line[j] === '{') {
        braceCount--;
        if (braceCount < 0) {
          // Found the opening brace, look for function declaration above
          for (let k = i; k >= Math.max(0, i - 3); k--) {
            const m = lines[k].match(funcPattern);
            if (m) return m[1];
          }
          return 'unknown';
        }
      }
    }
  }
  return 'file-scope';
}

/**
 * Extract synchronization primitive usage
 * @param {string} srcDir - source directory
 * @param {Object} [options] - {customPatterns: [{type: string, pattern: string|RegExp}]}
 * @returns {Array<{type: string, file: string, line: number, scope: string}>}
 */
function extractSyncPrimitives(srcDir, options) {
  const sourceFiles = collectSourceFiles(srcDir);
  const results = [];

  // Build pattern list: defaults + custom
  const patterns = [...DEFAULT_SYNC_PATTERNS];
  if (options && options.customPatterns) {
    for (const cp of options.customPatterns) {
      const regex = typeof cp.pattern === 'string' ? new RegExp(cp.pattern, 'g') : cp.pattern;
      patterns.push({ type: cp.type, pattern: regex });
    }
  }

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relPath = path.relative(srcDir, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

      for (const { type, pattern } of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        if (regex.test(line)) {
          const scope = findEnclosingFunction(content, i);
          results.push({
            type,
            file: relPath,
            line: i + 1,
            scope,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Extract context switch points
 * @param {string} srcDir - source directory
 * @param {Object} [options] - {switchPatterns: string[]}
 * @returns {Array<{function: string, file: string, line: number, callerFunction: string}>}
 */
function extractContextSwitchPoints(srcDir, options) {
  const sourceFiles = collectSourceFiles(srcDir);
  const results = [];

  // Build pattern list
  const patterns = [...DEFAULT_SWITCH_PATTERNS];
  if (options && options.switchPatterns) {
    for (const sp of options.switchPatterns) {
      patterns.push(new RegExp(sp, 'g'));
    }
  }

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relPath = path.relative(srcDir, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

      for (const pattern of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        const match = regex.exec(line);
        if (match) {
          // Extract the matched function name
          const funcName = match[0].replace(/\s*\($/, '');
          const caller = findEnclosingFunction(content, i);

          results.push({
            function: funcName,
            file: relPath,
            line: i + 1,
            callerFunction: caller,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Extract C11 atomic operations and GCC __sync builtins usage
 * @param {string} srcDir - source directory
 * @returns {Array<{type: string, operation: string, file: string, line: number, variable: string}>}
 */
function extractAtomicOps(srcDir) {
  const sourceFiles = collectSourceFiles(srcDir);
  const results = [];

  const atomicPatterns = [
    // C11 atomic operations
    { type: 'c11-atomic', pattern: /\b(atomic_load|atomic_store|atomic_exchange|atomic_compare_exchange_strong|atomic_compare_exchange_weak|atomic_fetch_add|atomic_fetch_sub|atomic_fetch_or|atomic_fetch_and|atomic_fetch_xor)\s*\(\s*&?\s*(\w+)/g },
    // C11 atomic type declaration
    { type: 'c11-atomic-decl', pattern: /\b(_Atomic)\s+\w+\s+(\w+)/g },
    // GCC __atomic builtins
    { type: 'gcc-atomic', pattern: /\b(__atomic_load|__atomic_store|__atomic_exchange|__atomic_compare_exchange|__atomic_add_fetch|__atomic_sub_fetch|__atomic_fetch_add|__atomic_fetch_sub)\s*\(\s*&?\s*(\w+)/g },
    // GCC __sync builtins (legacy)
    { type: 'gcc-sync', pattern: /\b(__sync_fetch_and_add|__sync_fetch_and_sub|__sync_val_compare_and_swap|__sync_lock_test_and_set|__sync_lock_release|__sync_synchronize)\s*\(\s*&?\s*(\w+)/g },
  ];

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(srcDir, filePath);

    for (const { type, pattern } of atomicPatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        results.push({
          type,
          operation: match[1],
          file: relPath,
          line,
          variable: match[2] || '',
        });
      }
    }
  }

  return results;
}

module.exports = {
  extractGlobalVariables,
  extractSyncPrimitives,
  extractContextSwitchPoints,
  extractAtomicOps,
};
