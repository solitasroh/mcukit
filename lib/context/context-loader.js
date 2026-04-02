/**
 * Context Loader - Extract context from PDCA documents
 * @module lib/context/context-loader
 * @version 2.0.5
 *
 * Loads Plan/Design documents and extracts structured context
 * for downstream modules. Domain-agnostic by design.
 */

const fs = require('fs');
const path = require('path');
const { findDoc } = require('../core/paths');

/**
 * Load Plan document and extract requirements/constraints
 * @param {string} feature - Feature name
 * @returns {{ requirements: string[], constraints: string[], raw: string }}
 */
function loadPlanContext(feature) {
  const docPath = findDoc('plan', feature);
  const result = { requirements: [], constraints: [], raw: '' };

  if (!docPath) return result;

  try {
    const content = fs.readFileSync(docPath, 'utf8');
    result.raw = content;
    result.requirements = extractSection(content, 'requirement');
    result.constraints = extractSection(content, 'constraint');
  } catch (e) {
    // Document unreadable — return empty context
  }

  return result;
}

/**
 * Load Design document and extract architecture decisions / file list
 * @param {string} feature - Feature name
 * @returns {{ decisions: string[], files: string[], modules: string[], raw: string }}
 */
function loadDesignContext(feature) {
  const docPath = findDoc('design', feature);
  const result = { decisions: [], files: [], modules: [], raw: '' };

  if (!docPath) return result;

  try {
    const content = fs.readFileSync(docPath, 'utf8');
    result.raw = content;
    result.decisions = extractSection(content, 'decision');
    result.files = extractFileList(content);
    result.modules = extractSection(content, 'module');
  } catch (e) {
    // Document unreadable — return empty context
  }

  return result;
}

/**
 * Extract 5-line Context Anchor (WHY/WHO/RISK/SUCCESS/SCOPE)
 * @param {string} feature - Feature name
 * @returns {{ WHY: string, WHO: string, RISK: string, SUCCESS: string, SCOPE: string }}
 */
function extractContextAnchor(feature) {
  const anchor = { WHY: '', WHO: '', RISK: '', SUCCESS: '', SCOPE: '' };
  const planCtx = loadPlanContext(feature);
  const designCtx = loadDesignContext(feature);
  const combined = planCtx.raw + '\n' + designCtx.raw;

  if (!combined.trim()) return anchor;

  // Extract from explicit anchor block if present
  const anchorBlock = combined.match(/<!--\s*CONTEXT[_-]ANCHOR\s*-->([\s\S]*?)(?:<!--\s*\/CONTEXT[_-]ANCHOR\s*-->|$)/i);
  if (anchorBlock) {
    const block = anchorBlock[1];
    const keys = ['WHY', 'WHO', 'RISK', 'SUCCESS', 'SCOPE'];
    for (const key of keys) {
      const match = block.match(new RegExp(key + '\\s*[:：]\\s*(.+)', 'i'));
      if (match) anchor[key] = match[1].trim();
    }
    return anchor;
  }

  // Fallback: heuristic extraction from document sections
  anchor.WHY = extractFirstBullet(combined, ['목적', 'purpose', 'why', '배경', 'background']);
  anchor.WHO = extractFirstBullet(combined, ['대상', 'target', 'who', '사용자', 'user', 'stakeholder']);
  anchor.RISK = extractFirstBullet(combined, ['위험', 'risk', '제약', 'constraint', 'limitation']);
  anchor.SUCCESS = extractFirstBullet(combined, ['성공', 'success', 'criteria', '완료 조건', 'acceptance']);
  anchor.SCOPE = extractFirstBullet(combined, ['범위', 'scope', '대상 파일', 'boundary']);

  return anchor;
}

/**
 * Inject Context Anchor into a template string
 * @param {string} template - Template content
 * @param {{ WHY: string, WHO: string, RISK: string, SUCCESS: string, SCOPE: string }} anchor
 * @returns {string} Template with anchor injected
 */
function injectAnchorToTemplate(template, anchor) {
  if (!anchor || !template) return template || '';

  const anchorBlock = [
    '<!-- CONTEXT_ANCHOR -->',
    'WHY: ' + (anchor.WHY || 'N/A'),
    'WHO: ' + (anchor.WHO || 'N/A'),
    'RISK: ' + (anchor.RISK || 'N/A'),
    'SUCCESS: ' + (anchor.SUCCESS || 'N/A'),
    'SCOPE: ' + (anchor.SCOPE || 'N/A'),
    '<!-- /CONTEXT_ANCHOR -->',
  ].join('\n');

  // Replace placeholder if present, otherwise prepend
  if (template.includes('{{CONTEXT_ANCHOR}}')) {
    return template.replace('{{CONTEXT_ANCHOR}}', anchorBlock);
  }

  return anchorBlock + '\n\n' + template;
}

// ── Internal Helpers ──────────────────────────────────────────────

/**
 * Extract bullet items from a markdown section by heading keywords
 * @param {string} content - Document content
 * @param {string} sectionKeyword - Heading keyword to match (case-insensitive)
 * @returns {string[]} Extracted bullet items
 */
function extractSection(content, sectionKeyword) {
  const items = [];
  const pattern = new RegExp(
    '^#{1,4}\\s+.*' + sectionKeyword + '.*$',
    'gim'
  );
  const matches = content.match(pattern);
  if (!matches) return items;

  for (const heading of matches) {
    const idx = content.indexOf(heading);
    const afterHeading = content.substring(idx + heading.length);
    // Capture until next heading or end
    const sectionEnd = afterHeading.search(/^#{1,4}\s/m);
    const section = sectionEnd > 0 ? afterHeading.substring(0, sectionEnd) : afterHeading;

    // Extract bullet items
    const bullets = section.match(/^[\s]*[-*]\s+(.+)$/gm);
    if (bullets) {
      for (const b of bullets) {
        items.push(b.replace(/^[\s]*[-*]\s+/, '').trim());
      }
    }
  }

  return items;
}

/**
 * Extract file paths from markdown content
 * @param {string} content
 * @returns {string[]}
 */
function extractFileList(content) {
  const files = [];
  // Match backtick-wrapped file paths
  const pattern = /`([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)`/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const candidate = match[1];
    // Filter to likely file paths (contains / or known extensions)
    if (candidate.includes('/') || /\.(c|h|s|ld|dts|dtsi|bb|csproj|cs|xaml|js|json|md|yml|yaml)$/.test(candidate)) {
      if (files.indexOf(candidate) === -1) {
        files.push(candidate);
      }
    }
  }
  return files;
}

/**
 * Extract first bullet item from a section matching any of the keywords
 * @param {string} content
 * @param {string[]} keywords
 * @returns {string}
 */
function extractFirstBullet(content, keywords) {
  for (const kw of keywords) {
    const pattern = new RegExp(
      '^#{1,4}\\s+.*' + kw + '.*$',
      'im'
    );
    const heading = content.match(pattern);
    if (!heading) continue;

    const idx = content.indexOf(heading[0]);
    const after = content.substring(idx + heading[0].length, idx + heading[0].length + 500);
    const bullet = after.match(/^[\s]*[-*]\s+(.+)$/m);
    if (bullet) return bullet[1].trim();
  }
  return '';
}

module.exports = {
  loadPlanContext,
  loadDesignContext,
  extractContextAnchor,
  injectAnchorToTemplate,
};
