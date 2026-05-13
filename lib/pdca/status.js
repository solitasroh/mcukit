/**
 * PDCA Status Management Module — Facade
 * @module lib/pdca/status
 * @version 2.1.0
 *
 * Cycle 2 G adopt (SQ-004 split): re-exports from 5 submodules under
 * lib/pdca/status/. External 27 exports preserved 100% (FR-12 compat
 * matrix 13/13). 27 = 25 unique functions + 2 backward-compat aliases
 * (readBkitMemory / writeBkitMemory).
 *
 * Submodules:
 *   - status/schema          — createInitialStatusV2, migrateStatus*
 *   - status/store           — file/cache IO + auto-migration dispatch
 *   - status/feature-lifecycle — feature CRUD + cleanup + limit
 *   - status/context         — extractFeatureFromContext
 *   - status/memory-io       — readMemory / writeMemory
 */

const schema = require('./status/schema');
const store = require('./status/store');
const lifecycle = require('./status/feature-lifecycle');
const context = require('./status/context');
const memoryIo = require('./status/memory-io');

module.exports = {
  // schema
  createInitialStatusV2: schema.createInitialStatusV2,
  migrateStatusToV2: schema.migrateStatusToV2,
  migrateStatusV2toV3: schema.migrateStatusV2toV3,

  // store
  getPdcaStatusPath: store.getPdcaStatusPath,
  initPdcaStatusIfNotExists: store.initPdcaStatusIfNotExists,
  getPdcaStatusFull: store.getPdcaStatusFull,
  loadPdcaStatus: store.loadPdcaStatus,
  savePdcaStatus: store.savePdcaStatus,

  // feature lifecycle
  getFeatureStatus: lifecycle.getFeatureStatus,
  updatePdcaStatus: lifecycle.updatePdcaStatus,
  addPdcaHistory: lifecycle.addPdcaHistory,
  completePdcaFeature: lifecycle.completePdcaFeature,
  setActiveFeature: lifecycle.setActiveFeature,
  addActiveFeature: lifecycle.addActiveFeature,
  removeActiveFeature: lifecycle.removeActiveFeature,
  deleteFeatureFromStatus: lifecycle.deleteFeatureFromStatus,
  enforceFeatureLimit: lifecycle.enforceFeatureLimit,
  getArchivedFeatures: lifecycle.getArchivedFeatures,
  cleanupArchivedFeatures: lifecycle.cleanupArchivedFeatures,
  archiveFeatureToSummary: lifecycle.archiveFeatureToSummary,
  getActiveFeatures: lifecycle.getActiveFeatures,
  switchFeatureContext: lifecycle.switchFeatureContext,

  // context
  extractFeatureFromContext: context.extractFeatureFromContext,

  // memory IO + backward-compat aliases
  readMemory: memoryIo.readMemory,
  writeMemory: memoryIo.writeMemory,
  readBkitMemory: memoryIo.readMemory,
  writeBkitMemory: memoryIo.writeMemory,
};
