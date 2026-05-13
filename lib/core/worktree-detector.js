/**
 * Git Worktree Detector — rkit Cycle 2 candidate A partial_adopt
 *
 * Sourced from bkit-claude-code/lib/core/worktree-detector.js (cycle 2 sync)
 * with mandatory privacy patches per council security HIGH-3:
 *
 *   Original (REJECTED): raw absolute paths (toplevel/gitDir/gitCommonDir)
 *   written to .bkit/runtime/worktree-warning.flag and stderr.
 *
 *   rkit patch: paths replaced with anonymizeFingerprint() values.
 *   Flag file relocated to .rkit/runtime/ (rkit Path Registry standard).
 *   stderr message uses fingerprints, not absolute paths.
 *
 * Claude Code hooks may not fire in linked git worktrees because hook paths
 * resolve relative to the primary `.git` directory. This module detects
 * worktree context at session start, emits a stderr advisory, and writes
 * an advisory flag file.
 *
 * Linked worktree heuristic: `git rev-parse --git-dir` differs from
 * `git rev-parse --git-common-dir` (both resolved absolute).
 *
 * Privacy guarantee: no raw username/HOME/hostname/git URL/absolute path
 * is persisted. Only fingerprints are written.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { anonymizeFingerprint } = require('./anonymize-fingerprint');

function safeGit(args, cwd) {
  try {
    return execSync(`git ${args}`, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

/**
 * Inspect the current git context.
 *
 * Returns RAW paths for internal use only — callers must NOT persist these
 * directly. Use {@link detectAndWarn} which writes only fingerprints.
 *
 * @param {string} [cwd]
 * @returns {{ isWorktree: boolean, toplevel: string|null, gitDir: string|null, gitCommonDir: string|null }}
 */
function inspectWorktree(cwd) {
  const target = cwd == null ? process.cwd() : cwd;
  const toplevel = safeGit('rev-parse --show-toplevel', target);
  const gitDir = safeGit('rev-parse --git-dir', target);
  const gitCommonDir = safeGit('rev-parse --git-common-dir', target);
  if (!toplevel || !gitDir || !gitCommonDir) {
    return { isWorktree: false, toplevel, gitDir, gitCommonDir };
  }
  const absGitDir = path.resolve(toplevel, gitDir);
  const absCommon = path.resolve(toplevel, gitCommonDir);
  return {
    isWorktree: absGitDir !== absCommon,
    toplevel,
    gitDir: absGitDir,
    gitCommonDir: absCommon,
  };
}

/**
 * Detect worktree + write advisory flag with anonymized payload.
 *
 * Idempotent, never throws (flag is advisory).
 *
 * @param {string} [cwd]
 * @returns {{ isWorktree: boolean, flagPath?: string, toplevelFp?: string, gitDirFp?: string, gitCommonDirFp?: string }}
 */
function detectAndWarn(cwd) {
  const target = cwd == null ? process.cwd() : cwd;
  const info = inspectWorktree(target);
  if (!info.isWorktree) return info;

  // FR-09 patch: anonymize every absolute path before persistence
  const toplevelFp = anonymizeFingerprint(info.toplevel);
  const gitDirFp = anonymizeFingerprint(info.gitDir);
  const gitCommonDirFp = anonymizeFingerprint(info.gitCommonDir);

  // rkit Path Registry: .rkit/runtime/ (not .bkit/runtime/)
  const flagPath = path.join(target, '.rkit', 'runtime', 'worktree-warning.flag');
  const payload = {
    detectedAt: new Date().toISOString(),
    toplevelFp,
    gitDirFp,
    gitCommonDirFp,
    issue: 'https://github.com/anthropics/claude-code/issues/46808',
    message:
      'git worktree detected — Claude Code hooks may not fire (issue #46808). ' +
      'Run rkit from the primary repository if hook-driven automation is required.',
  };
  try {
    fs.mkdirSync(path.dirname(flagPath), { recursive: true });
    // Atomic write (tmpfile + rename) per Design §3.0 common NFR
    const tmp = flagPath + '.tmp.' + process.pid + '.' + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
    fs.renameSync(tmp, flagPath);
    // stderr message uses fingerprint, not absolute path
    process.stderr.write(
      `\n[rkit] WARNING: git worktree detected (#46808) — hooks may not fire. fp=${toplevelFp}\n`,
    );
  } catch {
    // Non-fatal: flag is advisory
  }

  return { ...info, flagPath, toplevelFp, gitDirFp, gitCommonDirFp };
}

module.exports = { inspectWorktree, detectAndWarn };
