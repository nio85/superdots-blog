#!/usr/bin/env node

/**
 * sync-tools.mjs — Synchronizes tool JSON definitions into the SKILL.md catalog
 * and tool-registry.json for the Superdots agent platform.
 *
 * Usage:
 *   node scripts/tools/sync-tools.mjs [--dry-run] [--json]
 *
 * Reads:   /home/luca/paperclip/skills/superdots-tools/references/tools/*.json
 * Schema:  /home/luca/paperclip/skills/superdots-tools/references/schemas/tool-definition.schema.json
 * Writes:  /home/luca/paperclip/skills/superdots-tools/references/tool-registry.json
 *          /home/luca/paperclip/skills/superdots-tools/SKILL.md (catalog section only)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, basename, resolve } from 'path';

// --- Paths ---
const SKILLS_ROOT = '/home/luca/paperclip/skills/superdots-tools';
const TOOLS_DIR = join(SKILLS_ROOT, 'references/tools');
const SCHEMA_PATH = join(SKILLS_ROOT, 'references/schemas/tool-definition.schema.json');
const REGISTRY_PATH = join(SKILLS_ROOT, 'references/tool-registry.json');
const SKILL_MD_PATH = join(SKILLS_ROOT, 'SKILL.md');
const AGENTS_ROOT = '/home/luca/paperclip/agents/superdots/agents';

const BEGIN_MARKER = '<!-- BEGIN TOOL CATALOG -->';
const END_MARKER = '<!-- END TOOL CATALOG -->';

// --- CLI flags ---
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const jsonOutput = args.includes('--json');

// --- Report accumulator ---
const report = {
  toolsFound: 0,
  toolsValid: 0,
  toolsInvalid: [],
  registryUpdated: false,
  skillMdUpdated: false,
  agentWarnings: [],
  errors: [],
};

// --- Helpers ---

function formatAccess(access) {
  const r = access.read ? 'R' : '-';
  const w = access.write ? 'W' : '-';
  const d = access.delete ? 'D' : '-';
  return `${r}/${w}/${d}`;
}

function authSummary(auth) {
  const map = {
    'bearer-token': 'Bearer token',
    'api-key-header': 'API key header',
    'http-basic': 'HTTP Basic',
    'service-account': 'Service account',
    'session': 'Session',
    'smtp': 'SMTP credentials',
    'cli-token': 'CLI token',
  };
  return map[auth.method] || auth.method;
}

function categoryLabel(cat) {
  const map = {
    'local-service': 'local',
    'cloud-api': 'cloud',
    'internal': 'internal',
  };
  return map[cat] || cat;
}

function categoryHeading(cat) {
  const map = {
    'local-service': 'Local Services',
    'cloud-api': 'Cloud APIs',
    'internal': 'Internal',
  };
  return map[cat] || cat;
}

function shortBaseUrl(url) {
  try {
    return url.replace(/^https?:\/\//, '');
  } catch {
    return url;
  }
}

function shortWrapper(wrapperScript) {
  if (!wrapperScript) return '-';
  // If it's a CLI tool name, return as-is
  if (!wrapperScript.startsWith('/')) return wrapperScript;
  // Strip the blog root prefix for brevity
  const blogRoot = '/home/luca/superdots-blog/';
  if (wrapperScript.startsWith(blogRoot)) {
    return wrapperScript.slice(blogRoot.length);
  }
  return wrapperScript;
}

// --- Schema validation (basic, no external deps) ---

function validateTool(tool, schema) {
  const errors = [];

  // Check required top-level fields
  for (const field of schema.required || []) {
    if (tool[field] === undefined || tool[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check types for present fields
  const props = schema.properties || {};
  for (const [key, spec] of Object.entries(props)) {
    if (tool[key] === undefined) continue;
    const val = tool[key];

    if (spec.type === 'string' && typeof val !== 'string') {
      errors.push(`Field '${key}' must be a string, got ${typeof val}`);
    }
    if (spec.type === 'object' && (typeof val !== 'object' || Array.isArray(val))) {
      errors.push(`Field '${key}' must be an object`);
    }
    if (spec.type === 'array' && !Array.isArray(val)) {
      errors.push(`Field '${key}' must be an array, got ${typeof val}`);
    }
    if (spec.type === 'boolean' && typeof val !== 'boolean') {
      errors.push(`Field '${key}' must be a boolean, got ${typeof val}`);
    }

    // Enum check
    if (spec.enum && !spec.enum.includes(val)) {
      errors.push(`Field '${key}' must be one of [${spec.enum.join(', ')}], got '${val}'`);
    }

    // Pattern check for strings
    if (spec.pattern && typeof val === 'string') {
      if (!new RegExp(spec.pattern).test(val)) {
        errors.push(`Field '${key}' does not match pattern ${spec.pattern}: '${val}'`);
      }
    }
  }

  // Validate auth sub-object
  if (tool.auth && typeof tool.auth === 'object') {
    const authProps = props.auth?.properties || {};
    if (!tool.auth.method) {
      errors.push("auth.method is required");
    } else if (authProps.method?.enum && !authProps.method.enum.includes(tool.auth.method)) {
      errors.push(`auth.method must be one of [${authProps.method.enum.join(', ')}], got '${tool.auth.method}'`);
    }
    if (tool.auth.envVars && !Array.isArray(tool.auth.envVars)) {
      errors.push("auth.envVars must be an array");
    }
  }

  // Validate access sub-object
  if (tool.access && typeof tool.access === 'object') {
    for (const field of ['read', 'write', 'delete']) {
      if (tool.access[field] !== undefined && typeof tool.access[field] !== 'boolean') {
        errors.push(`access.${field} must be a boolean`);
      }
    }
  }

  // Validate operations array
  if (Array.isArray(tool.operations)) {
    const opRequired = ['id', 'name', 'method', 'endpoint', 'description', 'accessLevel'];
    tool.operations.forEach((op, i) => {
      for (const field of opRequired) {
        if (!op[field]) {
          errors.push(`operations[${i}] missing required field: ${field}`);
        }
      }
    });
  }

  // Check for unknown top-level fields
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(tool)) {
      if (!props[key]) {
        errors.push(`Unknown field: '${key}'`);
      }
    }
  }

  return errors;
}

// --- Load tools ---

function loadTools() {
  if (!existsSync(TOOLS_DIR)) {
    report.errors.push(`Tools directory not found: ${TOOLS_DIR}`);
    return [];
  }

  const files = readdirSync(TOOLS_DIR).filter(f => f.endsWith('.json')).sort();
  report.toolsFound = files.length;

  let schema = null;
  if (existsSync(SCHEMA_PATH)) {
    try {
      schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    } catch (e) {
      report.errors.push(`Failed to parse schema: ${e.message}`);
    }
  } else {
    report.errors.push(`Schema not found at ${SCHEMA_PATH} — skipping validation`);
  }

  const tools = [];
  for (const file of files) {
    const filePath = join(TOOLS_DIR, file);
    try {
      const tool = JSON.parse(readFileSync(filePath, 'utf8'));

      if (schema) {
        const validationErrors = validateTool(tool, schema);
        if (validationErrors.length > 0) {
          report.toolsInvalid.push({ file, errors: validationErrors });
          console.error(`  INVALID: ${file}`);
          validationErrors.forEach(e => console.error(`    - ${e}`));
          continue;
        }
      }

      report.toolsValid++;
      tools.push(tool);
    } catch (e) {
      report.toolsInvalid.push({ file, errors: [`Parse error: ${e.message}`] });
      console.error(`  ERROR: ${file} — ${e.message}`);
    }
  }

  return tools;
}

// --- Generate registry ---

function generateRegistry(tools) {
  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    tools: tools.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      baseUrl: t.baseUrl,
      auth: t.auth.method,
      access: formatAccess(t.access),
      wrapperScript: t.wrapperScript || null,
      operationCount: t.operations.length,
    })),
  };
}

// --- Generate catalog markdown ---

function generateCatalog(tools) {
  const lines = [];

  lines.push('[This section is auto-generated by sync-tools.mjs. Do not edit manually.]');
  lines.push('');

  // Quick reference table
  lines.push('| Tool | Type | Base URL | Auth | R/W/D | Wrapper Script |');
  lines.push('|------|------|----------|------|-------|----------------|');

  // Sort: local-service first, cloud-api second, internal last
  const categoryOrder = { 'local-service': 0, 'cloud-api': 1, 'internal': 2 };
  const sorted = [...tools].sort((a, b) =>
    (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99)
  );

  for (const t of sorted) {
    const row = [
      t.name,
      categoryLabel(t.category),
      shortBaseUrl(t.baseUrl),
      authSummary(t.auth),
      formatAccess(t.access),
      shortWrapper(t.wrapperScript),
    ];
    lines.push(`| ${row.join(' | ')} |`);
  }

  lines.push('');

  // Category sections
  const categories = ['local-service', 'cloud-api', 'internal'];
  for (const cat of categories) {
    const catTools = sorted.filter(t => t.category === cat);
    if (catTools.length === 0) continue;

    lines.push(`### ${categoryHeading(cat)}`);
    lines.push('');

    for (const t of catTools) {
      const authNote = t.auth.notes || authSummary(t.auth);
      const wrapper = t.wrapperScript
        ? `\nWrapper: \`${t.wrapperScript.startsWith('/') ? 'node ' + t.wrapperScript : t.wrapperScript} <command>\``
        : '';

      lines.push(`**${t.name}** — ${t.description.split('.')[0]}.`);
      const authStr = authNote.endsWith('.') ? authNote : authNote + '.';
      lines.push(`Auth: ${authStr}${wrapper}`);
      if (t.notes) {
        lines.push(t.notes);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// --- Update SKILL.md ---

function updateSkillMd(catalogContent) {
  if (!existsSync(SKILL_MD_PATH)) {
    report.errors.push(`SKILL.md not found at ${SKILL_MD_PATH}`);
    return false;
  }

  const content = readFileSync(SKILL_MD_PATH, 'utf8');
  const beginIdx = content.indexOf(BEGIN_MARKER);
  const endIdx = content.indexOf(END_MARKER);

  if (beginIdx === -1 || endIdx === -1) {
    report.errors.push('SKILL.md missing BEGIN/END TOOL CATALOG markers');
    return false;
  }

  const before = content.slice(0, beginIdx + BEGIN_MARKER.length);
  const after = content.slice(endIdx);

  const newContent = `${before}\n${catalogContent}\n${after}`;

  if (newContent === content) {
    return false; // no changes needed
  }

  if (!dryRun) {
    writeFileSync(SKILL_MD_PATH, newContent, 'utf8');
  }
  return true;
}

// --- Check AGENTS.md files ---

function checkAgentToolSections(toolNames) {
  if (!existsSync(AGENTS_ROOT)) {
    report.errors.push(`Agents directory not found: ${AGENTS_ROOT}`);
    return;
  }

  const entries = readdirSync(AGENTS_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;

    const agentsFile = join(AGENTS_ROOT, entry.name, 'AGENTS.md');
    if (!existsSync(agentsFile)) continue;

    const content = readFileSync(agentsFile, 'utf8');

    // Find ## Tools section
    const toolsMatch = content.match(/^## Tools\s*\n([\s\S]*?)(?=\n## |\n*$)/m);
    if (!toolsMatch) continue;

    const toolsSection = toolsMatch[1];

    // Extract tool names from bold markers in bullet points: - **ToolName** (...)
    const mentioned = [];
    const boldInBullet = /^[-*]\s+\*\*([^*]+)\*\*/gm;
    let match;
    while ((match = boldInBullet.exec(toolsSection)) !== null) {
      // Extract just the tool name, strip parenthetical like "(localhost:3005)"
      const raw = match[1].trim().replace(/\s*\(.*\)$/, '');
      mentioned.push(raw);
    }

    // Check each mentioned tool exists in registry (match by name, case-insensitive)
    const toolNameSet = new Set(toolNames.map(n => n.toLowerCase()));
    // Also create aliases for compound names like "Dev.to + Hashnode" → match individually
    for (const name of mentioned) {
      // Handle compound names (e.g. "Dev.to + Hashnode", "GA4 + GSC")
      const parts = name.includes('+') ? name.split('+').map(p => p.trim()) : [name];
      for (const part of parts) {
        if (!toolNameSet.has(part.toLowerCase())) {
          // Also try matching as abbreviated forms (GA4→Google Analytics 4, GSC→Google Search Console, CF Analytics→Cloudflare Analytics)
          const aliases = {
            'ga4': 'google analytics 4',
            'gsc': 'google search console',
            'cf analytics': 'cloudflare analytics',
            'cloudflare analytics': 'cloudflare analytics',
          };
          const aliasMatch = aliases[part.toLowerCase()];
          if (aliasMatch && toolNameSet.has(aliasMatch)) continue;

          report.agentWarnings.push({
            agent: entry.name,
            tool: part,
            message: `Tool '${part}' mentioned in ${entry.name}/AGENTS.md ## Tools but not found in registry`,
          });
        }
      }
    }
  }
}

// --- Main ---

function main() {
  if (!jsonOutput) {
    console.log('sync-tools: Synchronizing tool definitions...');
    if (dryRun) console.log('  (dry-run mode — no files will be written)');
    console.log('');
  }

  // 1. Load and validate tools
  if (!jsonOutput) console.log('Loading tool definitions...');
  const tools = loadTools();

  if (tools.length === 0 && report.toolsFound === 0) {
    report.errors.push('No tool JSON files found');
  }

  // 2. Generate registry
  if (!jsonOutput) console.log('Generating tool registry...');
  const registry = generateRegistry(tools);

  if (tools.length > 0) {
    const registryJson = JSON.stringify(registry, null, 2) + '\n';
    let currentRegistry = '';
    if (existsSync(REGISTRY_PATH)) {
      currentRegistry = readFileSync(REGISTRY_PATH, 'utf8');
    }
    if (registryJson !== currentRegistry) {
      report.registryUpdated = true;
      if (!dryRun) {
        writeFileSync(REGISTRY_PATH, registryJson, 'utf8');
      }
    }
  }

  // 3. Generate and update SKILL.md catalog
  if (!jsonOutput) console.log('Updating SKILL.md catalog...');
  if (tools.length > 0) {
    const catalog = generateCatalog(tools);
    report.skillMdUpdated = updateSkillMd(catalog);
  }

  // 4. Check AGENTS.md tool references
  if (!jsonOutput) console.log('Checking agent tool references...');
  const toolNames = tools.map(t => t.name);
  checkAgentToolSections(toolNames);

  // 5. Print report
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('');
    console.log('=== Sync Report ===');
    console.log(`Tools found:     ${report.toolsFound}`);
    console.log(`Tools valid:     ${report.toolsValid}`);
    console.log(`Tools invalid:   ${report.toolsInvalid.length}`);
    console.log(`Registry:        ${report.registryUpdated ? (dryRun ? 'would update' : 'updated') : 'no changes'}`);
    console.log(`SKILL.md:        ${report.skillMdUpdated ? (dryRun ? 'would update' : 'updated') : 'no changes'}`);

    if (report.toolsInvalid.length > 0) {
      console.log('');
      console.log('Invalid tools:');
      for (const t of report.toolsInvalid) {
        console.log(`  ${t.file}: ${t.errors.join('; ')}`);
      }
    }

    if (report.agentWarnings.length > 0) {
      console.log('');
      console.log('Agent tool warnings:');
      for (const w of report.agentWarnings) {
        console.log(`  ${w.message}`);
      }
    }

    if (report.errors.length > 0) {
      console.log('');
      console.log('Errors:');
      for (const e of report.errors) {
        console.log(`  ${e}`);
      }
    }

    console.log('');
    if (dryRun) {
      console.log('Dry run complete. No files were modified.');
    } else {
      console.log('Done.');
    }
  }

  // Exit with error code if there were validation errors
  if (report.toolsInvalid.length > 0 || report.errors.length > 0) {
    process.exit(1);
  }
}

main();
