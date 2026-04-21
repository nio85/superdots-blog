#!/usr/bin/env node

/**
 * Migration: Add contentPillar field to all blog article frontmatter.
 *
 * - All existing articles get contentPillar: "dot-by-dot" (the default)
 * - Exception: how-we-run-blog-with-ai-agents.md gets "behind-the-dots"
 *
 * Run once: node scripts/migrations/add-content-pillar.mjs
 * Dry run:  node scripts/migrations/add-content-pillar.mjs --dry-run
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BLOG_DIR = join(import.meta.dirname, '../../src/content/blog');
const DRY_RUN = process.argv.includes('--dry-run');

const SPECIAL_CASES = {
  'how-we-run-blog-with-ai-agents.md': 'behind-the-dots',
};

const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

let updated = 0;
let skipped = 0;

for (const file of files) {
  const filePath = join(BLOG_DIR, file);
  const content = readFileSync(filePath, 'utf-8');

  // Skip if contentPillar already present
  if (/^contentPillar:/m.test(content)) {
    skipped++;
    continue;
  }

  const pillar = SPECIAL_CASES[file] || 'dot-by-dot';

  // Insert contentPillar after the useCase line (or after author if no useCase)
  let newContent;
  if (/^useCase:/m.test(content)) {
    newContent = content.replace(
      /^(useCase:.*?)$/m,
      `$1\ncontentPillar: "${pillar}"`
    );
  } else if (/^author:/m.test(content)) {
    newContent = content.replace(
      /^(author:.*?)$/m,
      `$1\ncontentPillar: "${pillar}"`
    );
  } else {
    console.warn(`  WARN: Could not find insertion point in ${file}, skipping`);
    skipped++;
    continue;
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] Would add contentPillar: "${pillar}" to ${file}`);
  } else {
    writeFileSync(filePath, newContent, 'utf-8');
  }
  updated++;
}

console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Total: ${files.length}`);
if (DRY_RUN) console.log('(dry run — no files were modified)');
