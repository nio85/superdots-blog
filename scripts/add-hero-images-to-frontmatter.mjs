#!/usr/bin/env node
/**
 * Add heroImage field to all blog post frontmatter.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const BLOG_DIR = join(import.meta.dirname, '..', 'src', 'content', 'blog');

const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));

for (const file of files) {
  const filePath = join(BLOG_DIR, file);
  const content = readFileSync(filePath, 'utf-8');
  const slug = basename(file, '.md').replace(/\.mdx$/, '');
  const heroImagePath = `/images/blog/${slug}.svg`;

  // Check if heroImage already exists
  if (content.match(/^heroImage:/m)) {
    console.log(`⊘ ${file} — already has heroImage`);
    continue;
  }

  // Insert heroImage before the closing --- of frontmatter
  // Find the second --- (end of frontmatter)
  const fmEnd = content.indexOf('---', content.indexOf('---') + 3);
  if (fmEnd === -1) {
    console.log(`✗ ${file} — no frontmatter found`);
    continue;
  }

  const updated = content.slice(0, fmEnd) + `heroImage: "${heroImagePath}"\n` + content.slice(fmEnd);
  writeFileSync(filePath, updated, 'utf-8');
  console.log(`✓ ${file} → ${heroImagePath}`);
}

console.log(`\nDone.`);
