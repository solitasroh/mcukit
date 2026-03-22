/**
 * lib/ui — Workflow Visualization UX Public API
 * @module lib/ui
 * @version 2.0.0
 *
 * Re-exports all UI visualization components.
 * Each component works independently with pure ANSI + Unicode Box Drawing.
 */

module.exports = {
  // ANSI utilities
  ...require('./ansi'),

  // Components
  renderPdcaProgressBar: require('./progress-bar').renderPdcaProgressBar,
  renderWorkflowMap:     require('./workflow-map').renderWorkflowMap,
  renderAgentPanel:      require('./agent-panel').renderAgentPanel,
  renderImpactView:      require('./impact-view').renderImpactView,
  renderControlPanel:    require('./control-panel').renderControlPanel,
};
