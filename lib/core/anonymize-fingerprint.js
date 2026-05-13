/**
 * Anonymized Fingerprint Helper — Cycle 2 FR-09
 *
 * Privacy-preserving identifier for paths and contexts. Used by:
 *   - lib/core/worktree-detector.js (toplevel/gitDir/gitCommonDir anonymization)
 *   - lib/cc-regression/ (sessionFp, future cycle 2 module E)
 *
 * Algorithm (Design v0.2 §3.6):
 *   fingerprint = sha256(per_device_salt + ':' + normalize_path(absolute_path)).slice(0, 14)
 *
 * Determinism: same device + same path → same fingerprint.
 * Privacy: raw username/HOME/hostname/git URL never stored.
 *
 * Council reflected:
 *   security HIGH-1: win32 only lowercase, POSIX preserves case
 *   code-analyzer HIGH-1: O_EXCL atomic salt creation (race protection)
 *   security MEDIUM-1: Windows icacls fallback (0o600 no-op on win32)
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const SALT_PATH = path.join(os.homedir(), '.rkit', 'device-salt');

function applyWindowsAcl(file) {
  if (process.platform !== 'win32') return;
  try {
    // Prefer os.userInfo() (trusted Node.js syscall) over $USERNAME env var
    // which is user-controlled and could be overridden to a wider principal
    // (e.g. "Everyone"). Fall back to env only if syscall fails. (PR #6 I-3)
    let user;
    try { user = os.userInfo().username; }
    catch { user = process.env.USERNAME; }
    if (!user || typeof user !== 'string') return;
    execFileSync('icacls', [file, '/inheritance:r', '/grant:r', `${user}:F`], { stdio: 'ignore' });
  } catch {
    // ACL failure is non-fatal; salt still readable by current user under
    // default Windows ACL. Continue (fail-soft).
  }
}

function getOrCreateSalt() {
  try {
    return fs.readFileSync(SALT_PATH, 'utf8').trim();
  } catch {
    fs.mkdirSync(path.dirname(SALT_PATH), { recursive: true });
    const salt = crypto.randomBytes(32).toString('hex');
    try {
      // O_EXCL atomic create — refuses to overwrite if another process won race
      const fd = fs.openSync(SALT_PATH, 'wx', 0o600);
      fs.writeSync(fd, salt);
      fs.closeSync(fd);
      applyWindowsAcl(SALT_PATH);
      return salt;
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Another process created salt first — read it instead
        return fs.readFileSync(SALT_PATH, 'utf8').trim();
      }
      throw err;
    }
  }
}

/**
 * Normalize a filesystem path for anonymization.
 *  - POSIX slashes (backslash -> slash)
 *  - Trailing slash removed
 *  - Lowercase ONLY on win32 (Linux/Mac case-sensitive FS preserved)
 *
 * @param {string} absPath
 * @returns {string}
 */
function normalizePath(absPath) {
  const slashed = String(absPath).replace(/\\/g, '/').replace(/\/$/, '');
  return process.platform === 'win32' ? slashed.toLowerCase() : slashed;
}

/**
 * Compute anonymized 14-character fingerprint for a path.
 *
 * @param {string} absPath - Absolute filesystem path
 * @returns {string} 14-char hex fingerprint
 */
function anonymizeFingerprint(absPath) {
  const salt = getOrCreateSalt();
  const normalized = normalizePath(absPath);
  return crypto
    .createHash('sha256')
    .update(salt + ':' + normalized)
    .digest('hex')
    .slice(0, 14);
}

module.exports = {
  anonymizeFingerprint,
  normalizePath,
  // Exposed for testing only — do NOT use directly in production code
  _getOrCreateSalt: getOrCreateSalt,
  _SALT_PATH: SALT_PATH,
};
