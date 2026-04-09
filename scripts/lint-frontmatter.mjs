#!/usr/bin/env node
/**
 * Frontmatter linter for blog articles.
 *
 * Checks for: duplicate YAML keys, missing required fields, invalid enum values.
 * Used by: git pre-commit hook + CI.
 *
 * Usage:
 *   node scripts/lint-frontmatter.mjs                    # lint all articles
 *   node scripts/lint-frontmatter.mjs file1.md file2.md  # lint specific files
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = resolve(__dirname, '../src/content/blog');

const REQUIRED_FIELDS = ['title', 'description', 'pubDate', 'author', 'tags'];
const VALID_DEPARTMENTS = ['engineering', 'marketing', 'sales', 'hr', 'finance', 'operations', 'legal', 'customer-support', 'design'];
const VALID_USE_CASES = ['automation', 'analysis', 'writing', 'communication'];

function lintFile(filePath) {
  const errors = [];
  const content = readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);

  if (!match) {
    errors.push('No frontmatter block found');
    return errors;
  }

  const fm = match[1];
  const lines = fm.split('\n');

  // Check duplicate top-level keys
  const seen = new Map();
  for (let i = 0; i < lines.length; i++) {
    const keyMatch = lines[i].match(/^([a-zA-Z_]\w*)\s*:/);
    if (keyMatch) {
      const key = keyMatch[1];
      if (seen.has(key)) {
        errors.push(`Duplicate key "${key}" (lines ${seen.get(key) + 2} and ${i + 2})`);
      } else {
        seen.set(key, i);
      }
    }
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!seen.has(field)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate enum values
  if (seen.has('department')) {
    const val = extractValue(lines[seen.get('department')]);
    if (val && !VALID_DEPARTMENTS.includes(val)) {
      errors.push(`Invalid department: "${val}" (valid: ${VALID_DEPARTMENTS.join(', ')})`);
    }
  }
  if (seen.has('useCase')) {
    const val = extractValue(lines[seen.get('useCase')]);
    if (val && !VALID_USE_CASES.includes(val)) {
      errors.push(`Invalid useCase: "${val}" (valid: ${VALID_USE_CASES.join(', ')})`);
    }
  }

  // Check for duplicate FAQ: faqs in frontmatter AND ## FAQ in body
  if (seen.has('faqs')) {
    const body = content.slice(match[0].length);
    if (/^## FAQ/m.test(body)) {
      errors.push('Duplicate FAQ: faqs in frontmatter AND "## FAQ" in article body. Remove the body FAQ section — the frontmatter accordion is the canonical source.');
    }
  }

  return errors;
}

function extractValue(line) {
  const m = line.match(/^\w+\s*:\s*['"]?([^'"#\n]+?)['"]?\s*$/);
  return m ? m[1].trim() : null;
}

// Determine files to lint
let files = process.argv.slice(2);
if (files.length === 0) {
  files = readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.md') || f.endsWith('.mdx'))
    .map(f => join(BLOG_DIR, f));
}

let totalErrors = 0;
let scheduledCount = 0;
const today = new Date().toISOString().slice(0, 10);

for (const file of files) {
  const errors = lintFile(file);
  const short = file.replace(/.*src\/content\/blog\//, '');
  if (errors.length > 0) {
    console.error(`\n  ${short}:`);
    for (const e of errors) {
      console.error(`    - ${e}`);
    }
    totalErrors += errors.length;
  }

  // Informational: detect scheduled (future-dated) articles
  const raw = readFileSync(file, 'utf-8');
  const fm = raw.match(/^---\s*\n([\s\S]*?)\n---/)?.[1] ?? '';
  const pubMatch = fm.match(/pubDate:\s*['"]?(\d{4}-\d{2}-\d{2})['"]?/);
  if (pubMatch && pubMatch[1] > today) {
    console.log(`  ℹ️  Scheduled: "${short}" → pubDate ${pubMatch[1]} (future, will publish at next daily deploy after that date)`);
    scheduledCount++;
  }
}

if (scheduledCount > 0) {
  console.log(`\n📅 ${scheduledCount} article(s) scheduled for future publication.\n`);
}

if (totalErrors > 0) {
  console.error(`\n${totalErrors} frontmatter issue(s) found.\n`);
  process.exit(1);
} else {
  console.log('Frontmatter OK');
}
