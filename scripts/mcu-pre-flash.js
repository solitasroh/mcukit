#!/usr/bin/env node
/**
 * MCU Pre-Flash Safety Check Hook
 * @version 0.2.0
 *
 * Trigger: PreToolUse(Bash) when flash/erase command detected
 * Blocks dangerous erase commands, validates binary size.
 */

const path = require('path');
const fs = require('fs');

function getIo() { return require('../lib/core/io'); }
function getDebug() { return require('../lib/core/debug'); }

try {
  const { readStdinSync, parseHookInput, outputAllow, outputBlock } = getIo();
  const { debugLog } = getDebug();

  const input = readStdinSync();
  if (!input) { outputAllow(); process.exit(0); }

  const { command } = parseHookInput(input);
  if (!command) { outputAllow(); process.exit(0); }

  const cmdLower = command.toLowerCase();

  // Flash tool patterns
  const flashTools = ['st-flash', 'stm32_programmer_cli', 'jlinkexe', 'jlink.exe', 'openocd'];
  const isFlashCommand = flashTools.some(t => cmdLower.includes(t));

  if (!isFlashCommand) {
    outputAllow();
    process.exit(0);
  }

  debugLog('MCU-PreFlash', 'Flash command detected', { command });

  // Block erase commands
  const erasePatterns = [
    { pattern: 'erase', reason: 'Flash erase command detected. This will erase chip memory.' },
    { pattern: '-e all', reason: 'CubeProgrammer full erase. This will erase all flash sectors.' },
    { pattern: 'mass_erase', reason: 'OpenOCD mass erase. This will erase entire flash.' },
  ];

  for (const { pattern, reason } of erasePatterns) {
    if (cmdLower.includes(pattern)) {
      outputBlock(`[rkit] ${reason} Manual confirmation required.`);
      process.exit(0);
    }
  }

  // Validate binary file exists (for write commands)
  if (cmdLower.includes('write') || cmdLower.includes('-w ')) {
    // Try to extract binary path from command
    const binMatch = command.match(/(?:write|w)\s+["']?([^\s"']+\.(?:bin|hex|elf))/i);
    if (binMatch) {
      const binPath = binMatch[1];
      if (!fs.existsSync(binPath)) {
        outputBlock(`[rkit] Binary file not found: ${binPath}`);
        process.exit(0);
      }

      // Check binary size vs typical flash size (warn if > 2MB)
      const stat = fs.statSync(binPath);
      if (stat.size > 2 * 1024 * 1024) {
        outputBlock(`[rkit] Binary size ${(stat.size / 1024 / 1024).toFixed(1)}MB seems too large for MCU flash. Verify target.`);
        process.exit(0);
      }
    }
  }

  // Validate target address for ST-Link
  if (cmdLower.includes('st-flash') && cmdLower.includes('write')) {
    const addrMatch = command.match(/0x([0-9a-fA-F]+)\s*$/);
    if (addrMatch) {
      const addr = parseInt(addrMatch[1], 16);
      // STM32 flash typically starts at 0x08000000
      if (addr !== 0x08000000 && addr < 0x08000000) {
        outputBlock(`[rkit] Unusual flash address 0x${addrMatch[1]}. STM32 flash starts at 0x08000000.`);
        process.exit(0);
      }
    }
  }

  outputAllow();
  process.exit(0);

} catch (e) {
  try { getIo().outputAllow(); } catch (_) { console.log(JSON.stringify({})); }
  process.exit(0);
}
