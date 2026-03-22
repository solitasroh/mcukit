'use strict';

const fs = require('fs');
const path = require('path');
const { parseWorkflowYaml, validateWorkflow, loadWorkflowFile, listAvailableWorkflows, WORKFLOW_DIR_PROJECT } = require('./workflow-parser');

function getProjectDir() {
  try { return require('../core/platform').PROJECT_DIR; } catch (_) { return process.cwd(); }
}

// ── Constants ──────────────────────────────────────────────────────────────

const WORKFLOW_STATE_DIR = '.mcukit/state/workflows';
const DEFAULT_WORKFLOW_ID = 'default';
const HOTFIX_WORKFLOW_ID = 'hotfix';
const ENTERPRISE_WORKFLOW_ID = 'enterprise';

// ── Condition Evaluator ────────────────────────────────────────────────────

/**
 * Evaluate a simple condition expression against context variables.
 * Supported operators: ==, !=, >=, <=, >, <, &&, ||
 * Supported types: numbers, strings (quoted), booleans
 *
 * Security: Does NOT use eval(). Implements a safe expression parser.
 *
 * @param {string} expression - Condition expression (e.g., "matchRate >= 90")
 * @param {Object} variables - Context variables for evaluation
 * @returns {boolean}
 */
function evaluateCondition(expression, variables) {
  if (!expression || typeof expression !== 'string') return false;

  const expr = expression.trim();

  // Handle logical operators (split on && and ||)
  if (expr.includes('&&')) {
    const parts = expr.split('&&').map(p => p.trim());
    return parts.every(part => evaluateCondition(part, variables));
  }
  if (expr.includes('||')) {
    const parts = expr.split('||').map(p => p.trim());
    return parts.some(part => evaluateCondition(part, variables));
  }

  // Parse single comparison: "left op right"
  const operators = ['!=', '>=', '<=', '==', '>', '<'];
  let op = null;
  let opIdx = -1;

  for (const candidate of operators) {
    const idx = expr.indexOf(candidate);
    if (idx !== -1) {
      op = candidate;
      opIdx = idx;
      break;
    }
  }

  if (!op) {
    // Single boolean variable check
    const varName = expr.trim();
    return !!resolveVariable(varName, variables);
  }

  const leftRaw = expr.substring(0, opIdx).trim();
  const rightRaw = expr.substring(opIdx + op.length).trim();

  const left = resolveVariable(leftRaw, variables);
  const right = resolveVariable(rightRaw, variables);

  switch (op) {
    case '==': return left == right; // eslint-disable-line eqeqeq
    case '!=': return left != right; // eslint-disable-line eqeqeq
    case '>=': return left >= right;
    case '<=': return left <= right;
    case '>':  return left > right;
    case '<':  return left < right;
    default:   return false;
  }
}

/**
 * Resolve a variable name or literal value.
 * @param {string} raw - Raw token
 * @param {Object} variables - Context variables
 * @returns {*}
 */
function resolveVariable(raw, variables) {
  // Quoted string literal
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.substring(1, raw.length - 1);
  }

  // Boolean literal
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // Null
  if (raw === 'null') return null;

  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(raw)) return parseFloat(raw);

  // Variable lookup
  if (raw in variables) return variables[raw];

  // Nested property (e.g., "feature.startsWith")
  // Not supported in safe evaluator — return raw
  return raw;
}

// ── Workflow Execution ─────────────────────────────────────────────────────

/**
 * @typedef {Object} WorkflowExecution
 * @property {string} workflowId - Active workflow ID
 * @property {string} feature - Feature name
 * @property {string} currentStep - Current step ID in the workflow
 * @property {string[]} completedSteps - List of completed step IDs
 * @property {string} status - 'running' | 'paused' | 'completed' | 'error'
 * @property {number} startedAt - Execution start timestamp
 * @property {number} lastUpdated - Last update timestamp
 * @property {Object} context - Execution context (matchRate, iterationCount, etc.)
 */

/**
 * Start executing a workflow for a given feature.
 * @param {Object} workflowDef - Parsed WorkflowDefinition
 * @param {string} feature - Feature name
 * @param {Object} [context] - Initial context overrides
 * @returns {WorkflowExecution}
 */
function executeWorkflow(workflowDef, feature, context) {
  if (!workflowDef || !workflowDef.id || !workflowDef.steps) {
    throw new Error('executeWorkflow: invalid workflow definition');
  }
  if (!feature || typeof feature !== 'string') {
    throw new Error('executeWorkflow: feature name is required');
  }

  // Find the first step (usually 'start')
  const firstStep = findFirstStep(workflowDef);

  const execution = {
    workflowId: workflowDef.id,
    feature,
    currentStep: firstStep,
    completedSteps: [],
    status: 'running',
    startedAt: Date.now(),
    lastUpdated: Date.now(),
    context: {
      matchRate: 0,
      iterationCount: 0,
      maxIterations: workflowDef.defaults?.maxIterations || 5,
      matchRateThreshold: workflowDef.defaults?.matchRateThreshold || 90,
      automationLevel: workflowDef.defaults?.automationLevel || 'semi-auto',
      ...(context || {}),
    },
  };

  // Save execution state
  saveWorkflowState(feature, execution);

  return execution;
}

/**
 * Advance a workflow execution to the next step.
 * @param {WorkflowExecution} execution - Current execution state
 * @param {Object} workflowDef - Workflow definition
 * @returns {{ nextPhase: string|null, action: string, gate: Object|null, completed: boolean }}
 */
function advanceWorkflow(execution, workflowDef) {
  if (!execution || execution.status !== 'running') {
    return { nextPhase: null, action: 'none', gate: null, completed: false };
  }

  const steps = workflowDef.steps;
  const currentStepDef = steps[execution.currentStep];

  if (!currentStepDef) {
    execution.status = 'error';
    saveWorkflowState(execution.feature, execution);
    return { nextPhase: null, action: 'error', gate: null, completed: false };
  }

  // Mark current step as completed
  if (!execution.completedSteps.includes(execution.currentStep)) {
    execution.completedSteps.push(execution.currentStep);
  }

  // Execute onExit actions (symbolic — actual action execution is in state-machine)
  const onExitActions = currentStepDef.onExit || [];

  // Determine next step
  let nextStepId = null;

  // Check conditional branches first
  if (currentStepDef.conditions && Array.isArray(currentStepDef.conditions)) {
    for (const cond of currentStepDef.conditions) {
      if (evaluateCondition(cond.condition, execution.context)) {
        nextStepId = cond.next;
        break;
      }
    }
  }

  // Fall through to default next
  if (!nextStepId && currentStepDef.next) {
    nextStepId = currentStepDef.next;
  }

  // No next step — workflow complete
  if (!nextStepId) {
    execution.status = 'completed';
    execution.lastUpdated = Date.now();
    saveWorkflowState(execution.feature, execution);
    return { nextPhase: currentStepDef.phase, action: 'complete', gate: null, completed: true };
  }

  const nextStepDef = steps[nextStepId];
  if (!nextStepDef) {
    execution.status = 'error';
    saveWorkflowState(execution.feature, execution);
    return { nextPhase: null, action: 'error', gate: null, completed: false };
  }

  // Check for gate
  let gate = null;
  if (nextStepDef.type === 'gate' && nextStepDef.gate) {
    const gateConfig = nextStepDef.gate;

    if (gateConfig.approval === 'user') {
      gate = { type: 'user', message: gateConfig.message || 'Approval required to proceed.' };
    } else if (gateConfig.approval === 'conditional') {
      const autoPass = evaluateCondition(gateConfig.autoCondition, execution.context);
      if (!autoPass) {
        gate = { type: 'user', message: gateConfig.message || 'Approval required to proceed.' };
      }
      // If autoPass, gate is null (auto-approved)
    }
    // 'auto' approval — no gate needed
  }

  // Advance to next step
  execution.currentStep = nextStepId;
  execution.lastUpdated = Date.now();
  saveWorkflowState(execution.feature, execution);

  return {
    nextPhase: nextStepDef.phase,
    action: gate ? 'gate' : 'advance',
    gate,
    completed: false,
  };
}

/**
 * Get the workflow execution status for a feature.
 * @param {string} feature - Feature name
 * @param {string} [projectRoot] - Project root directory
 * @returns {{ currentStep: string, completedSteps: string[], progress: number, status: string } | null}
 */
function getWorkflowStatus(feature, projectRoot) {
  const execution = loadWorkflowState(feature, projectRoot);
  if (!execution) return null;

  // Calculate progress as percentage
  const totalSteps = execution.completedSteps.length + 1; // +1 for current
  // Estimate total from workflow (we don't have the def here, so use completed + remaining estimate)
  const progress = execution.status === 'completed'
    ? 100
    : Math.min(99, Math.round((execution.completedSteps.length / (execution.completedSteps.length + 3)) * 100));

  return {
    currentStep: execution.currentStep,
    completedSteps: execution.completedSteps,
    progress,
    status: execution.status,
    workflowId: execution.workflowId,
    context: execution.context,
    startedAt: execution.startedAt,
    lastUpdated: execution.lastUpdated,
  };
}

/**
 * Select the appropriate workflow for a feature based on naming and project level.
 * @param {string} feature - Feature name
 * @param {string} [level] - Project level ('Starter'|'Dynamic'|'Enterprise')
 * @param {string} [projectRoot] - Project root directory
 * @returns {Object|null} WorkflowDefinition or null if none found
 */
function selectWorkflow(feature, level, projectRoot) {
  const root = projectRoot || getProjectDir();
  const workflows = listAvailableWorkflows(root);

  if (workflows.length === 0) return null;

  // 1. Hotfix detection — feature name starts with 'hotfix-' or 'fix-'
  if (feature.startsWith('hotfix-') || feature.startsWith('fix-')) {
    const hotfix = workflows.find(w => w.name.toLowerCase().includes('hotfix'));
    if (hotfix) {
      try { return loadWorkflowFile(hotfix.path); } catch (_) { /* fall through */ }
    }
  }

  // 2. Enterprise level detection
  if (level === 'Enterprise') {
    const enterprise = workflows.find(w => w.name.toLowerCase().includes('enterprise'));
    if (enterprise) {
      try { return loadWorkflowFile(enterprise.path); } catch (_) { /* fall through */ }
    }
  }

  // 3. Default workflow
  const defaultWf = workflows.find(w =>
    w.name.toLowerCase().includes('default') || w.name.toLowerCase().includes('standard')
  );
  if (defaultWf) {
    try { return loadWorkflowFile(defaultWf.path); } catch (_) { /* fall through */ }
  }

  // 4. First available
  if (workflows.length > 0) {
    try { return loadWorkflowFile(workflows[0].path); } catch (_) { return null; }
  }

  return null;
}

// ── State Persistence ──────────────────────────────────────────────────────

/**
 * Save workflow execution state to disk.
 * @param {string} feature - Feature name
 * @param {WorkflowExecution} execution - Execution state
 * @param {string} [projectRoot] - Project root directory
 */
function saveWorkflowState(feature, execution, projectRoot) {
  const root = projectRoot || getProjectDir();
  const stateDir = path.join(root, WORKFLOW_STATE_DIR);

  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }

  const filePath = path.join(stateDir, `${sanitizeFilename(feature)}.json`);
  const content = JSON.stringify(execution, null, 2);

  // Atomic write: write to tmp then rename
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, content, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Load workflow execution state from disk.
 * @param {string} feature - Feature name
 * @param {string} [projectRoot] - Project root directory
 * @returns {WorkflowExecution|null}
 */
function loadWorkflowState(feature, projectRoot) {
  const root = projectRoot || getProjectDir();
  const filePath = path.join(root, WORKFLOW_STATE_DIR, `${sanitizeFilename(feature)}.json`);

  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (_) {
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find the first step in a workflow definition.
 * Looks for a step named 'start', or the first step with phase 'idle'.
 * @param {Object} workflowDef
 * @returns {string} Step ID
 */
function findFirstStep(workflowDef) {
  const stepIds = Object.keys(workflowDef.steps);

  // Look for 'start' step
  if (stepIds.includes('start')) return 'start';

  // Look for idle phase step
  for (const id of stepIds) {
    if (workflowDef.steps[id].phase === 'idle') return id;
  }

  // First step
  return stepIds[0] || 'start';
}

/**
 * Sanitize a feature name for use as a filename.
 * @param {string} name
 * @returns {string}
 */
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  // Core API
  executeWorkflow,
  advanceWorkflow,
  getWorkflowStatus,
  selectWorkflow,

  // Condition evaluation
  evaluateCondition,

  // State management
  saveWorkflowState,
  loadWorkflowState,

  // Constants
  WORKFLOW_STATE_DIR,
  DEFAULT_WORKFLOW_ID,
  HOTFIX_WORKFLOW_ID,
  ENTERPRISE_WORKFLOW_ID,

  // Exposed for testing
  _resolveVariable: resolveVariable,
  _findFirstStep: findFirstStep,
};
