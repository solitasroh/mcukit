#!/usr/bin/env node
/**
 * Code Review Skill Stop Hook
 *
 * Post code review next step guidance
 *
 * @version 1.6.0
 */

const { debugLog } = require('../lib/core/debug');
const { getPdcaStatusFull } = require('../lib/pdca/status');

async function main() {
  try {
    debugLog('CodeReviewStop', 'Hook triggered');

    // Get current PDCA status
    const pdcaStatus = getPdcaStatusFull();
    const currentFeature = pdcaStatus?.currentFeature;
    const currentPhase = pdcaStatus?.features?.[currentFeature]?.phase;

    // Suggest next steps based on context
    let suggestion = '';

    if (currentPhase === 'do') {
      suggestion = `
─────────────────────────────────────────────────
💡 Code Review Complete - Next Steps
─────────────────────────────────────────────────
Code review has been completed.

Recommended next steps:
1. Fix discovered issues
2. /simplify for automatic code quality improvement
3. Run Gap analysis: /pdca analyze ${currentFeature || '[feature]'}
4. Or request additional review

🔄 To re-review after fixes: /code-review [path]
─────────────────────────────────────────────────`;
    } else if (currentPhase === 'check') {
      suggestion = `
─────────────────────────────────────────────────
💡 Code Review Complete
─────────────────────────────────────────────────
Check phase code review has been completed.

Next steps based on match rate:
- ≥90%: /simplify code cleanup then /pdca report ${currentFeature || '[feature]'}
- <90%: /pdca iterate ${currentFeature || '[feature]'}
─────────────────────────────────────────────────`;
    } else {
      suggestion = `
─────────────────────────────────────────────────
💡 Code Review Complete
─────────────────────────────────────────────────
Code review has been completed.
Review discovered issues and proceed with necessary fixes.
─────────────────────────────────────────────────`;
    }

    console.log(suggestion);

  } catch (error) {
    debugLog('CodeReviewStop', 'Error in hook', { error: error.message });
  }
}

main();
