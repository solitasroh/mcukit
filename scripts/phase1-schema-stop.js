#!/usr/bin/env node
/**
 * phase1-schema-stop.js - Guide next steps after Schema/Terminology phase
 *
 * Purpose: Suggest Phase 2 (Conventions) after Schema phase completion
 * Hook: Stop for phase-1-schema skill
 *
 * v1.4.0: Pipeline Phase automation
 */

const { outputAllow } = require('../lib/core/hook-io');
const { checkPhaseDeliverables } = require('../lib/pdca/phase');

// Check if Phase 1 deliverables are complete
const deliverables = checkPhaseDeliverables(1);

let message;

if (deliverables.allComplete) {
  message = `✅ Phase 1 (Schema/Terminology) completed!

Deliverables verified:
${deliverables.items.map(item => `  ${item.exists ? '✅' : '❌'} ${item.name}`).join('\n')}

🎯 Next: Phase 2 - Coding Conventions
   Run: /phase-2-convention to define coding standards

💡 Tip: Clear conventions accelerate AI-assisted development.`;
} else {
  message = `📋 Phase 1 (Schema/Terminology) in progress.

Deliverables status:
${deliverables.items.map(item => `  ${item.exists ? '✅' : '⏳'} ${item.name}`).join('\n')}

Complete remaining items before proceeding to Phase 2.`;
}

// v1.4.0: Stop hook에 맞는 스키마 사용
outputAllow(message, 'Stop');
