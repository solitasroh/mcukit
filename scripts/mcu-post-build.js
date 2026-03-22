#!/usr/bin/env node
/**
 * MCU Post-Build Analysis Hook
 * @version 0.2.0
 *
 * Trigger: PostToolUse(Bash) when build command detected
 * Parses .map file and outputs memory usage dashboard.
 */

const path = require('path');

// Lazy requires
function getIo() { return require('../lib/core/io'); }
function getDebug() { return require('../lib/core/debug'); }
function getMcu() { return require('../lib/mcu'); }

try {
  const { readStdinSync, outputAllow } = getIo();
  const { debugLog } = getDebug();

  const input = readStdinSync();
  if (!input) { outputAllow(); process.exit(0); }

  const parsed = typeof input === 'string' ? JSON.parse(input) : input;
  const toolInput = parsed.tool_input || {};
  const toolOutput = parsed.tool_output || {};
  const command = toolInput.command || '';
  const exitCode = toolOutput.exit_code;

  // Only process successful build commands
  const buildPatterns = ['make', 'cmake --build', 'ninja', 'arm-none-eabi-gcc'];
  const isBuild = buildPatterns.some(p => command.includes(p));

  if (!isBuild || exitCode !== 0) {
    outputAllow();
    process.exit(0);
  }

  debugLog('MCU-PostBuild', 'Build detected', { command });

  const projectDir = process.cwd();
  const { findMapFile, parseMapFile, compareBuildMemory, formatMemoryReport } = getMcu();
  const { addBuildRecord } = require('../lib/mcu/build-history');

  // Find and parse .map file
  const mapFile = findMapFile(projectDir);
  if (!mapFile) {
    debugLog('MCU-PostBuild', 'No .map file found');
    outputAllow();
    process.exit(0);
  }

  const analysis = parseMapFile(mapFile);
  const delta = compareBuildMemory(analysis);

  // Record to build history
  addBuildRecord({
    feature: 'build',
    flash: analysis.flash,
    ram: analysis.ram,
    topSymbols: analysis.topSymbols.slice(0, 10),
  });

  // Format and output report
  const report = formatMemoryReport(analysis, delta);

  const response = {
    additionalContext: report,
  };

  console.log(JSON.stringify(response));
  process.exit(0);

} catch (e) {
  try {
    const { debugLog } = getDebug();
    debugLog('MCU-PostBuild', 'Error', { error: e.message });
  } catch (_) {}

  // Non-blocking - just allow the tool use
  try {
    const { outputAllow } = getIo();
    outputAllow();
  } catch (_) {
    console.log(JSON.stringify({}));
  }
  process.exit(0);
}
