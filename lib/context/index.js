/**
 * Context Module - Unified entry point
 * @module lib/context
 * @version 2.0.5
 *
 * Re-exports all context sub-modules for convenient access.
 * Each sub-module is independently usable via direct require.
 */

const contextLoader = require('./context-loader');
const impactAnalyzer = require('./impact-analyzer');
const invariantChecker = require('./invariant-checker');
const scenarioRunner = require('./scenario-runner');
const selfHealing = require('./self-healing');
const opsMetrics = require('./ops-metrics');
const decisionRecord = require('./decision-record');

module.exports = {
  // context-loader
  loadPlanContext: contextLoader.loadPlanContext,
  loadDesignContext: contextLoader.loadDesignContext,
  extractContextAnchor: contextLoader.extractContextAnchor,
  injectAnchorToTemplate: contextLoader.injectAnchorToTemplate,

  // impact-analyzer
  analyzeImpact: impactAnalyzer.analyzeImpact,
  getMemoryImpact: impactAnalyzer.getMemoryImpact,
  getDtsImpact: impactAnalyzer.getDtsImpact,
  getDependencyImpact: impactAnalyzer.getDependencyImpact,

  // invariant-checker
  checkInvariants: invariantChecker.checkInvariants,

  // scenario-runner
  runScenario: scenarioRunner.runScenario,
  getScenarioCommands: scenarioRunner.getScenarioCommands,

  // self-healing
  diagnose: selfHealing.diagnose,

  // ops-metrics
  collectMetrics: opsMetrics.collectMetrics,
  saveBenchmark: opsMetrics.saveBenchmark,
  loadBenchmarkHistory: opsMetrics.loadBenchmarkHistory,

  // decision-record
  recordDecision: decisionRecord.recordDecision,
  listDecisions: decisionRecord.listDecisions,
};
