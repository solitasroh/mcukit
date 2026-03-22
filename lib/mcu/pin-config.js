/**
 * CubeMX .ioc Pin Configuration Parser & Conflict Detector
 * @module lib/mcu/pin-config
 * @version 0.2.0
 *
 * .ioc format: Java Properties (flat key=value text, NOT XML/INI)
 * Pin key patterns:
 *   {PIN}.Signal={SIGNAL}       PA9.Signal=USART1_TX
 *   {PIN}.Mode={MODE}           PA9.Mode=Asynchronous
 *   {PIN}.GPIO_Label={LABEL}    PA9.GPIO_Label=DEBUG_TX
 *   {PIN}.Locked=true
 *   {PIN}.GPIO_PuPd={VALUE}
 *   {PIN}.GPIO_Speed={VALUE}
 *   Mcu.Pin{N}={PIN}            Mcu.Pin0=PA9
 *   Mcu.PinsNb={COUNT}
 *   Mcu.UserName={CHIP}         Mcu.UserName=STM32F407VGTx
 *   Mcu.IP{N}={IP}              Mcu.IP0=USART1
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse .ioc file into key-value Map
 * @param {string} iocFilePath
 * @returns {Map<string, string>}
 */
function parseIocFile(iocFilePath) {
  const content = fs.readFileSync(iocFilePath, 'utf-8');
  const map = new Map();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      map.set(key, value);
    }
  }

  return map;
}

/**
 * Extract pin assignments from parsed .ioc data
 * @param {Map<string, string>} iocData
 * @returns {Array<Object>}
 */
function extractPinAssignments(iocData) {
  const pinsNb = parseInt(iocData.get('Mcu.PinsNb') || '0', 10);
  const pins = [];

  // Collect pin names from Mcu.Pin{N}
  const pinNames = new Set();
  for (let i = 0; i < pinsNb; i++) {
    const pin = iocData.get(`Mcu.Pin${i}`);
    if (pin) pinNames.add(pin);
  }

  // Also scan for {PIN}.Signal keys directly
  for (const [key] of iocData) {
    const match = key.match(/^(P[A-K]\d+)\.Signal$/);
    if (match) pinNames.add(match[1]);
  }

  for (const pin of pinNames) {
    const signal = iocData.get(`${pin}.Signal`) || null;
    if (!signal) continue;

    const assignment = {
      pin,
      signal,
      mode: iocData.get(`${pin}.Mode`) || null,
      label: iocData.get(`${pin}.GPIO_Label`) || null,
      locked: iocData.get(`${pin}.Locked`) === 'true',
      gpio: null,
    };

    // GPIO-specific settings
    const pull = iocData.get(`${pin}.GPIO_PuPd`);
    const speed = iocData.get(`${pin}.GPIO_Speed`);
    if (pull || speed) {
      assignment.gpio = {
        pull: pull || null,
        speed: speed || null,
        output: iocData.get(`${pin}.GPIO_ModeDefaultOutputPP`) || null,
      };
    }

    pins.push(assignment);
  }

  return pins.sort((a, b) => a.pin.localeCompare(b.pin));
}

/**
 * Detect pin conflicts (same physical pin assigned to multiple signals)
 * @param {Array} pinAssignments
 * @returns {Array<{pin: string, conflicts: Array<{signal: string}>}>}
 */
function detectPinConflicts(pinAssignments) {
  const pinMap = new Map();

  for (const assignment of pinAssignments) {
    if (!pinMap.has(assignment.pin)) {
      pinMap.set(assignment.pin, []);
    }
    pinMap.get(assignment.pin).push({
      signal: assignment.signal,
      mode: assignment.mode,
    });
  }

  const conflicts = [];
  for (const [pin, signals] of pinMap) {
    if (signals.length > 1) {
      conflicts.push({ pin, conflicts: signals });
    }
  }

  return conflicts;
}

/**
 * Extract MCU chip name
 * @param {Map<string, string>} iocData
 * @returns {string|null}
 */
function extractChipName(iocData) {
  return iocData.get('Mcu.UserName') || iocData.get('Mcu.Name') || null;
}

/**
 * Extract peripheral list (IP blocks)
 * @param {Map<string, string>} iocData
 * @returns {Array<{name: string, instance: string}>}
 */
function extractPeripheralList(iocData) {
  const peripherals = [];
  let i = 0;

  while (true) {
    const ip = iocData.get(`Mcu.IP${i}`);
    if (!ip) break;

    // Extract instance number (USART1 → name:USART, instance:1)
    const match = ip.match(/^([A-Z_]+?)(\d*)$/);
    peripherals.push({
      name: match ? match[1] : ip,
      instance: match ? ip : ip,
    });
    i++;
  }

  return peripherals;
}

/**
 * Format pin assignment report
 * @param {Array} assignments
 * @param {Array} conflicts
 * @returns {string}
 */
function formatPinReport(assignments, conflicts) {
  let report = '';

  if (conflicts.length > 0) {
    report += 'Pin Conflicts Detected!\n';
    for (const c of conflicts) {
      report += `  ${c.pin} is assigned to:\n`;
      for (const s of c.conflicts) {
        report += `    - ${s.signal} (${s.mode || 'default'})\n`;
      }
    }
    report += '\n';
  }

  report += `Pin Assignments (${assignments.length} pins):\n`;
  report += '  Pin    | Signal           | Mode            | Label\n';
  report += '  -------|-----------------|-----------------|--------\n';
  for (const a of assignments.slice(0, 30)) {
    const pin = (a.pin || '').padEnd(6);
    const signal = (a.signal || '').padEnd(17);
    const mode = (a.mode || '').padEnd(17);
    const label = a.label || '';
    report += `  ${pin} | ${signal} | ${mode} | ${label}\n`;
  }

  if (assignments.length > 30) {
    report += `  ... and ${assignments.length - 30} more\n`;
  }

  return report;
}

module.exports = {
  parseIocFile,
  extractPinAssignments,
  detectPinConflicts,
  extractChipName,
  extractPeripheralList,
  formatPinReport,
};
