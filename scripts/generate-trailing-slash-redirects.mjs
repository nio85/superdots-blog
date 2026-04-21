#!/usr/bin/env node

/**
 * Post-build script: generates 301 redirect entries in dist/_redirects
 * for every page that Cloudflare Pages would otherwise 308 redirect.
 *
 * Cloudflare Pages auto-redirects /path → /path/ with 308 when
 * trailingSlash: 'always' is set. Google treats 301 as a stronger
 * canonical signal, so we override with explicit 301 entries.
 *
 * Run after `astro build`: node scripts/generate-trailing-slash-redirects.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = join(import.meta.dirname, '..', 'dist');
const REDIRECTS_PATH = join(DIST, '_redirects');

// Collect all index.html paths in dist/
function findIndexFiles(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      findIndexFiles(full, results);
    } else if (entry === 'index.html') {
      results.push(full);
    }
  }
  return results;
}

const indexFiles = findIndexFiles(DIST);

// Generate redirect entries: /blog/slug → /blog/slug/ 301
// Skip root index.html (/) — already has trailing slash
const redirectLines = [];
for (const file of indexFiles) {
  const dir = relative(DIST, join(file, '..'));
  if (!dir) continue; // root index.html → skip
  const withoutSlash = '/' + dir;
  const withSlash = '/' + dir + '/';
  redirectLines.push(`${withoutSlash} ${withSlash} 301`);
}

redirectLines.sort();

// Read existing _redirects (copied from public/ by Astro)
let existing = '';
try {
  existing = readFileSync(REDIRECTS_PATH, 'utf-8');
} catch {
  // No existing file
}

// Remove old generated section if present
const MARKER_START = '# AUTO-GENERATED: trailing-slash 301 overrides';
const MARKER_END = '# END AUTO-GENERATED';
const markerIdx = existing.indexOf(MARKER_START);
if (markerIdx !== -1) {
  const endIdx = existing.indexOf(MARKER_END);
  if (endIdx !== -1) {
    existing = existing.slice(0, markerIdx) + existing.slice(endIdx + MARKER_END.length + 1);
  }
}

// Remove the old single entry that this replaces
existing = existing.replace(/\n# SEO: consolidate trailing-slash split for indexed URLs \(308→301\)\n\/blog\/ai-compliance-tools \/blog\/ai-compliance-tools\/ 301\n?/, '\n');

// Append generated section
const generated = `\n${MARKER_START}\n${redirectLines.join('\n')}\n${MARKER_END}\n`;
const final = existing.trimEnd() + '\n' + generated;

writeFileSync(REDIRECTS_PATH, final);
console.log(`Generated ${redirectLines.length} trailing-slash 301 redirects in dist/_redirects`);
