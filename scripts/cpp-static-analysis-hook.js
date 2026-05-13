#!/usr/bin/env node
/**
 * C++ Static Analysis PostToolUse Hook — Node bridge to Python.
 *
 * Invoked from `unified-write-post.js::handleCppStaticAnalysis(input)`.
 * Spawns `hooks/cpp-post-edit.py` as child process with stdin JSON.
 *
 * rkit policy: non-blocking. Never outputs `decision: block`.
 * Python hook stderr is relayed to this process stderr (Claude sees it).
 *
 * Timeout: 3 seconds (design spec §4.7 p95 target). Must stay under the
 * parent hook timeout budget (hooks.json Write matcher = 5000ms,
 * Edit matcher = 10000ms shared with cppcheck). (PR #5 review C1/C2)
 *
 * Extension set: must match `scripts/cpp-static-analysis/cpp_parser.py`
 * CPP_EXTENSIONS (`.h .hpp .hxx .cpp .cxx .cc`) plus `.c` (MCU domain
 * core file type — tree-sitter-cpp parses C). (PR #5 review C6)
 *
 * Python interpreter: PYTHON env var override > `python3` (POSIX) >
 * `python` (Windows). Falls back gracefully if neither found. (PR #5 I1)
 */

const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

// SoT: must align with cpp_parser.py CPP_EXTENSIONS. `.c` added for MCU
// domain coverage — tree-sitter-cpp parses C files. (PR #5 review C6)
const CPP_EXTENSIONS = new Set([
  '.c', '.cpp', '.cc', '.cxx',
  '.h', '.hpp', '.hxx',
]);

// 3s timeout (was 10s) — must fit under Write matcher 5s budget so the
// parent unified-write-post.js can still run audit/loop-breaker/metrics
// after this completes. (PR #5 review C1/C2)
const HOOK_TIMEOUT_MS = 3000;

function getDebug() { return require('../lib/core/debug'); }

/**
 * Resolve plugin root. Prefer CLAUDE_PLUGIN_ROOT env var, fall back to relative.
 * @returns {string}
 */
function resolvePluginRoot() {
  return process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
}

let _pythonCmdCache = null;
/**
 * Resolve Python interpreter. PYTHON env > `python3` (POSIX) > `python`.
 * Cached after first probe. Returns null when no interpreter is found.
 * (PR #5 review I1)
 */
function resolvePythonCmd() {
  if (_pythonCmdCache !== null) return _pythonCmdCache;
  const candidates = [];
  if (process.env.PYTHON) candidates.push(process.env.PYTHON);
  if (process.platform === 'win32') {
    candidates.push('python', 'python3', 'py');
  } else {
    candidates.push('python3', 'python');
  }
  for (const cmd of candidates) {
    try {
      spawnSync(cmd, ['--version'], { timeout: 1500, stdio: 'ignore' });
      // If spawnSync returns without ENOENT, the binary exists.
      _pythonCmdCache = cmd;
      return cmd;
    } catch { /* try next */ }
  }
  _pythonCmdCache = '';
  return null;
}

/**
 * PostToolUse entry point. Called from unified-write-post.js / code-quality-hook.js.
 * @param {Object} input - Claude Code hook input (tool_input.file_path available)
 * @returns {boolean} true if processed, false if skipped
 */
function handleCppStaticAnalysis(input) {
  const filePath = input?.tool_input?.file_path;
  if (!filePath) return false;

  const ext = path.extname(filePath).toLowerCase();
  if (!CPP_EXTENSIONS.has(ext)) return false;

  const pluginRoot = resolvePluginRoot();
  const hookPath = path.join(pluginRoot, 'hooks', 'cpp-post-edit.py');
  const { debugLog } = getDebug();

  const pythonCmd = resolvePythonCmd();
  if (!pythonCmd) {
    // First-resort failure mode: no Python interpreter on PATH.
    // Surface to stderr (Claude sees it) instead of silent debug-only log.
    // (PR #5 review C5)
    process.stderr.write(
      `cpp-static-analysis: Python interpreter not found ` +
      `(tried PYTHON env, ${process.platform === 'win32' ? 'python/python3/py' : 'python3/python'}). ` +
      `Install Python 3.10+ or set PYTHON=<path>.\n`
    );
    debugLog('CppStaticAnalysis', 'no python interpreter', { file: filePath });
    return true;
  }

  try {
    execFileSync(pythonCmd, [hookPath], {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      timeout: HOOK_TIMEOUT_MS,
      env: {
        ...process.env,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
      stdio: ['pipe', 'pipe', 'inherit'], // stderr -> parent stderr (Claude sees)
    });
  } catch (e) {
    // Python hook is non-blocking by policy. Surface actionable errors to
    // stderr (Claude sees them) and log everything to debug. Previously
    // 100% silent when MCUKIT_DEBUG was unset. (PR #5 review C5)
    const code = e.code || 'UNKNOWN';
    if (code === 'ENOENT') {
      process.stderr.write(`cpp-static-analysis: '${pythonCmd}' not found — set PYTHON env\n`);
    } else if (code === 'ETIMEDOUT') {
      process.stderr.write(`cpp-static-analysis: ${path.basename(filePath)} exceeded ${HOOK_TIMEOUT_MS}ms — skipping\n`);
    } else if (code !== 0 && code !== undefined && typeof code === 'number') {
      // Python exited non-zero — already wrote to stderr (relayed); just log
      debugLog('CppStaticAnalysis', 'python hook non-zero exit', { file: filePath, code });
    } else {
      process.stderr.write(`cpp-static-analysis: hook failed (${code}): ${e.message}\n`);
    }
    debugLog('CppStaticAnalysis', 'python hook failed', {
      file: filePath,
      error: e.message,
      code: e.code,
    });
  }

  return true;
}

module.exports = { handleCppStaticAnalysis, CPP_EXTENSIONS, HOOK_TIMEOUT_MS, resolvePythonCmd };
