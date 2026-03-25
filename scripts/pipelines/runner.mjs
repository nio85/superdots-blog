#!/usr/bin/env node
/**
 * Pipeline Runner — Creates multi-step Paperclip task pipelines from JSON definitions.
 *
 * Usage:
 *   node scripts/pipelines/runner.mjs <pipeline-name>            # Run pipeline
 *   node scripts/pipelines/runner.mjs <pipeline-name> --dry-run  # Preview without API calls
 *   node scripts/pipelines/runner.mjs --list                     # List available pipelines
 *   node scripts/pipelines/runner.mjs <name> --var date=2026-03-26
 *
 * Can also be imported as a module:
 *   import { runPipeline } from './scripts/pipelines/runner.mjs';
 *   await runPipeline('daily-content', { dryRun: true });
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOG_ROOT } from '../config.mjs';
import { PaperclipClient } from './lib/paperclip-client.mjs';
import { resolve, resolveDescription } from './lib/template.mjs';

const DEFINITIONS_DIR = join(BLOG_ROOT, 'scripts', 'pipelines', 'definitions');

/**
 * Load and parse a pipeline definition JSON file.
 */
function loadDefinition(name) {
  const filePath = join(DEFINITIONS_DIR, `${name}.json`);
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Pipeline definition not found: ${filePath}`);
    }
    throw new Error(`Failed to parse ${filePath}: ${err.message}`);
  }
}

/**
 * List all available pipeline definitions.
 */
function listPipelines() {
  try {
    const files = readdirSync(DEFINITIONS_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => basename(f, '.json'));
  } catch { return []; }
}

/**
 * Run a pipeline by name.
 * @param {string} name - Pipeline name (matches definitions/{name}.json)
 * @param {object} options
 * @param {boolean} options.dryRun - Preview without API calls
 * @param {object} options.vars - Override variables
 * @param {string} options.companyId - Override company ID
 * @param {string} options.projectId - Override project ID
 * @returns {object} Result with parent and tasks created
 */
export async function runPipeline(name, { dryRun = false, vars = {}, companyId, projectId } = {}) {
  const def = loadDefinition(name);
  const pipeline = def.pipeline;

  if (!pipeline) throw new Error(`Invalid definition: missing "pipeline" root key`);
  if (!pipeline.tasks || !Array.isArray(pipeline.tasks)) throw new Error(`Invalid definition: missing "tasks" array`);

  // Build initial context from vars + definition vars
  const context = { ...pipeline.vars };
  // Resolve built-in variables in definition vars
  for (const [k, v] of Object.entries(context)) {
    context[k] = resolve(v, context);
  }
  // Apply user overrides
  Object.assign(context, vars);

  const client = dryRun ? null : new PaperclipClient({ companyId, projectId });
  const mode = dryRun ? '[DRY RUN] ' : '';

  console.log(`${mode}Running pipeline: ${pipeline.name || name}`);
  if (pipeline.description) console.log(`  ${pipeline.description}`);
  console.log();

  // Idempotency check
  if (pipeline.idempotency && !dryRun) {
    const query = resolve(pipeline.idempotency.query, context);
    const field = pipeline.idempotency.matchField || 'title';
    const existing = await client.searchIssues(query);
    if (Array.isArray(existing) && existing.some(i => i[field] === resolve(pipeline.parent?.title || query, context))) {
      console.log(`Pipeline already exists for today. Skipping.`);
      return { skipped: true };
    }
  }

  const results = { parent: null, tasks: [], failed: [] };

  // Create parent task
  if (pipeline.parent) {
    const parentTitle = resolve(pipeline.parent.title, context);
    const parentDesc = resolveDescription(pipeline.parent.description, context);
    const assigneeId = PaperclipClient.resolveAgent(pipeline.parent.assignee);

    if (dryRun) {
      console.log(`PARENT | ${pipeline.parent.assignee.padEnd(20)} | ${parentTitle}`);
      results.parent = { identifier: `${name.toUpperCase()}-PARENT`, id: 'dry-run-parent' };
    } else {
      const parent = await client.createIssue({
        title: parentTitle,
        description: parentDesc,
        status: pipeline.parent.status || 'todo',
        priority: pipeline.parent.priority || 'high',
        assigneeAgentId: assigneeId,
      });
      console.log(`PARENT | ${parent.identifier.padEnd(8)} | ${pipeline.parent.assignee.padEnd(20)} | ${parentTitle}`);
      results.parent = parent;
    }
    context._parent = results.parent;
  }

  // Validate task graph (check blockedBy references)
  const taskIds = new Set(pipeline.tasks.map(t => t.id));
  for (const task of pipeline.tasks) {
    if (task.blockedBy && !taskIds.has(task.blockedBy)) {
      throw new Error(`Task "${task.id}" references blockedBy "${task.blockedBy}" which does not exist. Valid: ${[...taskIds].join(', ')}`);
    }
  }

  // Create tasks in order
  for (const task of pipeline.tasks) {
    try {
      const title = resolve(task.title, context);
      const desc = resolveDescription(task.description, context);
      const assigneeId = PaperclipClient.resolveAgent(task.assignee);

      if (dryRun) {
        const fakeResult = { identifier: `${name.toUpperCase()}-${task.id.toUpperCase()}`, id: `dry-run-${task.id}`, title };
        context[task.id] = fakeResult;
        console.log(`  ${task.status.padEnd(8)} | ${task.assignee.padEnd(20)} | ${title}`);
        results.tasks.push(fakeResult);
      } else {
        const issue = await client.createIssue({
          title,
          description: desc,
          status: task.status || 'todo',
          priority: task.priority || 'medium',
          assigneeAgentId: assigneeId,
          parentId: results.parent?.id,
        });
        context[task.id] = { identifier: issue.identifier, id: issue.id, title: issue.title };
        console.log(`  ${issue.identifier.padEnd(8)} | ${task.assignee.padEnd(20)} | ${title}`);
        results.tasks.push(issue);
      }
    } catch (err) {
      console.error(`  FAILED (${task.id}): ${err.message}`);
      results.failed.push({ id: task.id, error: err.message });
    }
  }

  // Summary
  console.log();
  const parentId = results.parent?.identifier || 'none';
  console.log(`${mode}Pipeline complete: ${parentId} with ${results.tasks.length} subtasks${results.failed.length ? `, ${results.failed.length} failed` : ''}`);

  // Exit code for CLI
  if (results.failed.length > 0 && results.tasks.length > 0) {
    process.exitCode = 2; // partial failure
  } else if (results.failed.length > 0) {
    process.exitCode = 1; // total failure
  }

  return results;
}

// --- CLI entry point ---
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);

  if (args.includes('--list') || args.length === 0) {
    const pipelines = listPipelines();
    console.log('Available pipelines:');
    for (const p of pipelines) console.log(`  - ${p}`);
    if (pipelines.length === 0) console.log('  (none found)');
    process.exit(0);
  }

  const name = args[0];
  const dryRun = args.includes('--dry-run');
  const vars = {};
  for (const arg of args) {
    const m = arg.match(/^--var\s+(\w+)=(.+)$/);
    if (m) vars[m[1]] = m[2];
  }
  // Also handle --var key=val as two separate args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--var' && args[i + 1]) {
      const m = args[i + 1].match(/^(\w+)=(.+)$/);
      if (m) vars[m[1]] = m[2];
    }
  }

  const companyId = args.find(a => a.startsWith('--company-id='))?.split('=')[1];
  const projectId = args.find(a => a.startsWith('--project-id='))?.split('=')[1];

  runPipeline(name, { dryRun, vars, companyId, projectId }).catch(err => {
    console.error(`Pipeline failed: ${err.message}`);
    process.exit(1);
  });
}
