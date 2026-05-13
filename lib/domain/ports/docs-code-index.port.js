/**
 * DocsCodeIndexPort — Type-only Port for docs ↔ code inventory cross-check.
 *
 * rkit Cycle 3 CR-2 partial_adopt. Sourced from bkit
 * lib/domain/ports/docs-code-index.port.js. Type-only contract.
 * Implementation: rkit lib/infra/docs-code-scanner.js (cycle 2 F adopted) —
 * measure() and scanVersions() are the production interface.
 * crossCheck() is a permanent stub — lib/domain/rules/docs-code-invariants.js
 * was not authored through cycle 5 (sync v2 final). Reintroduction requires
 * a new candidate in cycle 6+.
 *
 * @module lib/domain/ports/docs-code-index
 */

/**
 * @typedef {Object} InventoryMeasurement
 * @property {number} skills - Count of SKILL.md directories
 * @property {number} agents - Count of agents/*.md files
 * @property {number} hookEvents - Count of hook event types in hooks.json
 * @property {number} hookBlocks - Count of hook blocks across all events
 * @property {number} mcpServers - Count of MCP server directories
 * @property {number} mcpTools - Count of rkit_* MCP tool names
 * @property {number} libModules - Count of .js files under lib/
 * @property {number} scripts - Count of .js files under scripts/
 */

/**
 * @typedef {Object} Discrepancy
 * @property {string} docPath - Relative document path
 * @property {string} field - InventoryMeasurement field name
 * @property {number} declared - Value declared in document
 * @property {number} actual - Value measured from filesystem
 */

/**
 * @typedef {Object} DocsCodeIndexPort
 * @property {() => Promise<InventoryMeasurement>} measure
 * @property {(docPath: string) => Promise<Discrepancy[]>} [crossCheck] - cycle 4+ optional
 */

module.exports = {};
