#!/usr/bin/env node
/**
 * Memory Variable Store (FR-08)
 * Session-persistent storage for cross-session data
 *
 * @version 1.6.0
 * @module lib/memory-store
 */

const fs = require('fs');
const path = require('path');

// Import from common.js (lazy to avoid circular dependency)

function getCommon() {
  if (!_common) {
    
  }
  return _common;
}

/**
 * Get memory file path
 * @returns {string}
 */
function getMemoryFilePath() {
  const { STATE_PATHS } = require('./core/paths');
  return STATE_PATHS.memory();
}

// In-memory cache
let _memoryCache = null;

/**
 * Load memory from file
 * @returns {Object}
 */
function loadMemory() {
  if (_memoryCache !== null) {
    return _memoryCache;
  }

  const MEMORY_FILE = getMemoryFilePath();

  try {
    if (fs.existsSync(MEMORY_FILE)) {
      _memoryCache = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
      return _memoryCache;
    }
  } catch (e) {
    core.debugLog('MemoryStore', 'Failed to load memory', { error: e.message });
  }

  _memoryCache = {};
  return _memoryCache;
}

/**
 * Save memory to file
 */
function saveMemory() {
  const MEMORY_FILE = getMemoryFilePath();

  try {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(_memoryCache, null, 2));
    core.debugLog('MemoryStore', 'Memory saved');
  } catch (e) {
    core.debugLog('MemoryStore', 'Failed to save memory', { error: e.message });
  }
}

/**
 * Get memory variable
 * @param {string} key - Variable key
 * @param {*} defaultValue - Default if not found
 * @returns {*}
 */
function getMemory(key, defaultValue = null) {
  const memory = loadMemory();
  return key in memory ? memory[key] : defaultValue;
}

/**
 * Set memory variable
 * @param {string} key - Variable key
 * @param {*} value - Value to store
 */
function setMemory(key, value) {
  loadMemory();
  _memoryCache[key] = value;
  saveMemory();
}

/**
 * Delete memory variable
 * @param {string} key - Variable key
 * @returns {boolean} True if key existed and was deleted
 */
function deleteMemory(key) {
  loadMemory();
  if (key in _memoryCache) {
    delete _memoryCache[key];
    saveMemory();
    return true;
  }
  return false;
}

/**
 * Get all memory variables
 * @returns {Object}
 */
function getAllMemory() {
  return { ...loadMemory() };
}

/**
 * Check if key exists
 * @param {string} key - Variable key
 * @returns {boolean}
 */
function hasMemory(key) {
  const memory = loadMemory();
  return key in memory;
}

/**
 * Get memory keys
 * @returns {string[]}
 */
function getMemoryKeys() {
  const memory = loadMemory();
  return Object.keys(memory);
}

/**
 * Update memory with partial object
 * @param {Object} updates - Partial updates
 */
function updateMemory(updates) {
  loadMemory();
  Object.assign(_memoryCache, updates);
  saveMemory();
}

/**
 * Clear all memory
 */
function clearMemory() {
  _memoryCache = {};
  saveMemory();
  core.debugLog('MemoryStore', 'Memory cleared');
}

/**
 * Get memory file path (for external access)
 * @returns {string}
 */
function getMemoryPath() {
  return getMemoryFilePath();
}

/**
 * Invalidate cache (force reload from file on next access)
 */
function invalidateCache() {
  _memoryCache = null;
}

module.exports = {
  getMemory,
  setMemory,
  deleteMemory,
  getAllMemory,
  hasMemory,
  getMemoryKeys,
  updateMemory,
  clearMemory,
  getMemoryPath,
  invalidateCache
};
