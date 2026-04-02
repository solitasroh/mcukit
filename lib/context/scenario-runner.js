/**
 * Scenario Runner - Domain-specific build/verification scenarios
 * @module lib/context/scenario-runner
 * @version 2.0.5
 *
 * Provides build scenario execution and command listing for MCU/MPU/WPF.
 * Does not execute destructive operations — only build and size commands.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/** Domain-specific scenario command definitions */
const SCENARIO_COMMANDS = {
  mcu: [
    {
      name: 'cmake-build',
      command: 'cmake --build build/ -j$(nproc)',
      description: 'Build MCU firmware with CMake',
      cwd: '{projectDir}',
      required: true,
    },
    {
      name: 'binary-size',
      command: 'arm-none-eabi-size build/*.elf',
      description: 'Report Flash/RAM usage',
      cwd: '{projectDir}',
      required: false,
    },
  ],
  mpu: [
    {
      name: 'dtc-validate',
      command: 'find . -name "*.dts" -exec dtc -I dts -O dtb -o /dev/null {} \\;',
      description: 'Validate Device Tree sources with dtc',
      cwd: '{projectDir}',
      required: false,
    },
    {
      name: 'bitbake-build',
      command: 'bitbake core-image-minimal',
      description: 'Yocto bitbake build (requires oe-init-build-env sourced)',
      cwd: '{projectDir}/build',
      required: true,
    },
  ],
  wpf: [
    {
      name: 'dotnet-build',
      command: 'dotnet build --no-restore',
      description: 'Build WPF project (assumes restore already done)',
      cwd: '{projectDir}',
      required: true,
    },
  ],
};

/**
 * Get scenario commands for a domain
 * @param {string} domain - Domain identifier (mcu/mpu/wpf)
 * @returns {{ name: string, command: string, description: string, cwd: string, required: boolean }[]}
 */
function getScenarioCommands(domain) {
  return SCENARIO_COMMANDS[domain] || [];
}

/**
 * Run build scenario for a domain
 * @param {string} domain - Domain identifier (mcu/mpu/wpf)
 * @param {string} projectDir - Absolute path to project root
 * @returns {{ domain: string, results: Object[], success: boolean, summary: string }}
 */
function runScenario(domain, projectDir) {
  var commands = getScenarioCommands(domain);
  var results = [];
  var allSuccess = true;

  if (commands.length === 0) {
    return {
      domain: domain,
      results: [],
      success: false,
      summary: 'No scenario commands defined for domain: ' + domain,
    };
  }

  for (var i = 0; i < commands.length; i++) {
    var cmd = commands[i];
    var cwd = cmd.cwd.replace('{projectDir}', projectDir);
    var result = {
      name: cmd.name,
      command: cmd.command,
      success: false,
      output: '',
      error: '',
      skipped: false,
    };

    // Check if cwd exists
    if (!fs.existsSync(cwd)) {
      result.skipped = true;
      result.error = 'Working directory not found: ' + cwd;
      if (cmd.required) allSuccess = false;
      results.push(result);
      continue;
    }

    try {
      var output = execSync(cmd.command, {
        cwd: cwd,
        stdio: 'pipe',
        timeout: 300000, // 5 minutes
        encoding: 'utf8',
      });
      result.success = true;
      result.output = output.substring(0, 2000); // Truncate large outputs
    } catch (e) {
      result.error = e.stderr ? e.stderr.toString().substring(0, 2000) : (e.message || 'Unknown error');
      result.output = e.stdout ? e.stdout.toString().substring(0, 2000) : '';
      if (cmd.required) allSuccess = false;
    }

    results.push(result);
  }

  var passed = results.filter(function (r) { return r.success; }).length;
  var total = results.filter(function (r) { return !r.skipped; }).length;

  return {
    domain: domain,
    results: results,
    success: allSuccess,
    summary: passed + '/' + total + ' scenario step(s) passed.',
  };
}

module.exports = {
  runScenario,
  getScenarioCommands,
};
