/**
 * Self-Healing - Build failure auto-diagnosis
 * @module lib/context/self-healing
 * @version 2.0.5
 *
 * Analyzes build error output and suggests fixes based on domain-specific
 * error pattern matching. Does NOT modify code — diagnosis and suggestions only.
 */

/** Domain-specific error pattern to fix strategy mapping */
const HEALING_STRATEGIES = {
  mcu: [
    {
      pattern: /undefined reference to [`'](\w+)[`']/,
      cause: 'Missing symbol definition or unlinked source file',
      suggest: function (match) {
        return 'Add the source file containing `' + match[1] + '` to CMakeLists.txt, '
          + 'or check if the function declaration matches the definition signature.';
      },
    },
    {
      pattern: /region [`'](FLASH|RAM)[`'] overflowed by (\d+) bytes/,
      cause: 'Memory region overflow',
      suggest: function (match) {
        return match[1] + ' overflowed by ' + match[2] + ' bytes. '
          + 'Options: optimize code size (-Os), remove unused functions (--gc-sections), '
          + 'or increase ' + match[1] + ' size in linker script (.ld).';
      },
    },
    {
      pattern: /fatal error: (\S+): No such file or directory/,
      cause: 'Missing header file',
      suggest: function (match) {
        return 'Header `' + match[1] + '` not found. Check include paths in CMakeLists.txt '
          + '(target_include_directories) or verify the file exists.';
      },
    },
    {
      pattern: /multiple definition of [`'](\w+)[`']/,
      cause: 'Duplicate symbol definition',
      suggest: function (match) {
        return 'Symbol `' + match[1] + '` defined in multiple translation units. '
          + 'Use `static` for file-local functions or ensure headers use `extern` declarations.';
      },
    },
    {
      pattern: /arm-none-eabi-gcc: error: unrecognized command[- ]line option [`']([^`']+)[`']/,
      cause: 'Invalid compiler option',
      suggest: function (match) {
        return 'Compiler option `' + match[1] + '` not recognized. '
          + 'Check toolchain version compatibility and CMakeLists.txt flags.';
      },
    },
  ],

  mpu: [
    {
      pattern: /Error: (.+\.dts):\s*(\d+)\.\d+-\d+\.\d+: syntax error/,
      cause: 'Device Tree syntax error',
      suggest: function (match) {
        return 'DTS syntax error in `' + match[1] + '` at line ' + match[2] + '. '
          + 'Check for missing semicolons, unmatched braces, or invalid property syntax.';
      },
    },
    {
      pattern: /ERROR: Nothing PROVIDES [`']([^`']+)[`']/,
      cause: 'Missing Yocto recipe or package',
      suggest: function (match) {
        return 'Recipe `' + match[1] + '` not found. Check DEPENDS in your recipe, '
          + 'verify the layer containing the recipe is added to bblayers.conf, '
          + 'and run `bitbake-layers show-recipes` to confirm availability.';
      },
    },
    {
      pattern: /ERROR: Task .+ failed with exit code [`'](\d+)[`']/,
      cause: 'Yocto task failure',
      suggest: function (match) {
        return 'Yocto task failed (exit code ' + match[1] + '). '
          + 'Check the task log: find tmp/work/ -name "log.do_*" for detailed errors.';
      },
    },
    {
      pattern: /COMPATIBLE_MACHINE.* didn't match/,
      cause: 'Machine compatibility mismatch',
      suggest: function () {
        return 'Recipe COMPATIBLE_MACHINE does not match current MACHINE setting. '
          + 'Add your MACHINE to the COMPATIBLE_MACHINE pattern in the recipe, '
          + 'or verify MACHINE is set correctly in local.conf.';
      },
    },
  ],

  wpf: [
    {
      pattern: /error CS0246: The type or namespace name '(\w+)' could not be found/,
      cause: 'Missing type or namespace reference',
      suggest: function (match) {
        return 'Type `' + match[1] + '` not found. Add the required NuGet package '
          + 'or add a `using` directive. Run `dotnet add package <PackageName>`.';
      },
    },
    {
      pattern: /error CS0103: The name '(\w+)' does not exist in the current context/,
      cause: 'Undefined variable or member',
      suggest: function (match) {
        return 'Symbol `' + match[1] + '` undefined. Check for typos, missing property '
          + 'declarations, or ensure the DataContext (ViewModel) is correctly set.';
      },
    },
    {
      pattern: /error MC\d+: .+'{x:Bind}'/,
      cause: 'x:Bind usage in WPF (UWP/WinUI only)',
      suggest: function () {
        return '{x:Bind} is NOT supported in WPF. Use {Binding} with INotifyPropertyChanged. '
          + 'For compiled bindings in WPF, use CommunityToolkit.Mvvm source generators.';
      },
    },
    {
      pattern: /error NETSDK\d+/,
      cause: '.NET SDK configuration error',
      suggest: function (match) {
        return 'NET SDK error: ' + match[0] + '. Verify <TargetFramework>net8.0-windows</TargetFramework> '
          + 'and <UseWPF>true</UseWPF> in .csproj. Run `dotnet --info` to check SDK version.';
      },
    },
    {
      pattern: /XamlParseException/,
      cause: 'XAML parsing error at runtime',
      suggest: function () {
        return 'XAML parse failure. Common causes: missing resource, wrong DataType, '
          + 'or invalid binding path. Check Output window for the specific XAML element.';
      },
    },
  ],
};

/**
 * Diagnose build error output and suggest fixes
 * @param {string} errorOutput - Build error output (stderr/stdout)
 * @param {string} [domain] - Domain identifier (mcu/mpu/wpf). Tries all if omitted.
 * @returns {{ diagnosed: boolean, matches: Object[], domain: string }}
 */
function diagnose(errorOutput, domain) {
  if (!errorOutput || typeof errorOutput !== 'string') {
    return { diagnosed: false, matches: [], domain: domain || 'unknown' };
  }

  var domainsToCheck = domain ? [domain] : ['mcu', 'mpu', 'wpf'];
  var matches = [];

  for (var d = 0; d < domainsToCheck.length; d++) {
    var strategies = HEALING_STRATEGIES[domainsToCheck[d]];
    if (!strategies) continue;

    for (var s = 0; s < strategies.length; s++) {
      var strategy = strategies[s];
      var match = errorOutput.match(strategy.pattern);
      if (match) {
        matches.push({
          domain: domainsToCheck[d],
          cause: strategy.cause,
          suggestion: strategy.suggest(match),
          matchedText: match[0],
        });
      }
    }
  }

  return {
    diagnosed: matches.length > 0,
    matches: matches,
    domain: domain || (matches.length > 0 ? matches[0].domain : 'unknown'),
  };
}

module.exports = {
  diagnose,
  HEALING_STRATEGIES,
};
