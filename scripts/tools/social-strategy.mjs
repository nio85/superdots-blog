#!/usr/bin/env node
/**
 * social-strategy.mjs — Read/write the shared social strategy state file.
 *
 * This file is the coordination layer between social routines:
 * - Weekly Plan (Mon 08:00) writes format allocation + content calendar
 * - Daily Social (Mon-Fri 13:00) reads today's slot, fills it
 * - Weekly Recycle (Fri 14:00) reads open slots, fills remaining
 * - Monthly Review (1st Mon) adds long-term insights
 *
 * Strategy file: /home/luca/superdots-cms/data/social-strategy.json
 *
 * Usage:
 *   node social-strategy.mjs read                              # Print current strategy as JSON
 *   node social-strategy.mjs set-allocation --json '{...}'     # Set format allocation for the week
 *   node social-strategy.mjs set-calendar --json '[...]'       # Set content calendar for the week
 *   node social-strategy.mjs fill-slot --day Mon --platform linkedin --slug <slug> --post-format carousel
 *   node social-strategy.mjs add-insight "<text>"              # Add a monthly insight
 *   node social-strategy.mjs open-slots                        # List unfilled slots this week
 *   node social-strategy.mjs reset-week                        # Reset calendar for new week (weekly plan does this)
 */

import { readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const STRATEGY_FILE = '/home/luca/superdots-cms/data/social-strategy.json';
const TMP_FILE = STRATEGY_FILE + '.tmp';
const LOCK_FILE = STRATEGY_FILE + '.lock';

// Map full day names to 3-letter abbreviations and vice versa
const DAY_MAP = {
  sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
  sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed',
  thu: 'Thu', fri: 'Fri', sat: 'Sat',
};

function normalizeDay(input) {
  return DAY_MAP[input.toLowerCase()] || input;
}

function readStrategy() {
  try {
    return JSON.parse(readFileSync(STRATEGY_FILE, 'utf-8'));
  } catch {
    return {
      weekOf: null,
      updatedAt: null,
      updatedBy: null,
      formatAllocation: {},
      contentCalendar: [],
      monthlyInsights: [],
      activeExperiments: [],
    };
  }
}

function acquireLock() {
  mkdirSync(dirname(LOCK_FILE), { recursive: true });
  for (let i = 0; i < 30; i++) {
    try {
      const fd = openSync(LOCK_FILE, 'wx');
      closeSync(fd);
      return;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  throw new Error('Could not acquire lock after 3s — another process may be writing');
}

function releaseLock() {
  try { unlinkSync(LOCK_FILE); } catch {}
}

function writeStrategy(data, updatedBy) {
  acquireLock();
  try {
    data.updatedAt = new Date().toISOString();
    data.updatedBy = updatedBy;
    writeFileSync(TMP_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    renameSync(TMP_FILE, STRATEGY_FILE);
  } finally {
    releaseLock();
  }
}

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.error(`Usage: social-strategy.mjs <command>
Commands:
  read                Print current strategy as JSON
  set-allocation      Set format allocation (--json '{...}')
  set-calendar        Set content calendar (--json '[...]')
  fill-slot           Mark a slot as filled (--day --platform --slug --post-format)
  add-insight         Add a monthly insight (pass text as next arg)
  open-slots          List unfilled slots
  reset-week          Reset calendar for new week (--week-of YYYY-MM-DD)`);
  process.exit(1);
}

switch (command) {
  case 'read': {
    const strategy = readStrategy();
    console.log(JSON.stringify(strategy, null, 2));
    break;
  }

  case 'set-allocation': {
    const json = getFlag('--json');
    if (!json) { console.error('Error: --json required'); process.exit(1); }
    const allocation = JSON.parse(json);
    const strategy = readStrategy();
    strategy.formatAllocation = allocation;
    writeStrategy(strategy, 'weekly-social-plan');
    console.error('[STRATEGY] Format allocation updated.');
    console.log(JSON.stringify(strategy.formatAllocation, null, 2));
    break;
  }

  case 'set-calendar': {
    const json = getFlag('--json');
    if (!json) { console.error('Error: --json required'); process.exit(1); }
    const calendar = JSON.parse(json);
    if (!Array.isArray(calendar)) { console.error('Error: calendar must be an array'); process.exit(1); }
    const strategy = readStrategy();
    strategy.contentCalendar = calendar;
    writeStrategy(strategy, 'weekly-social-plan');
    console.error(`[STRATEGY] Content calendar updated (${calendar.length} slots).`);
    console.log(JSON.stringify(strategy.contentCalendar, null, 2));
    break;
  }

  case 'fill-slot': {
    const day = getFlag('--day');
    const platform = getFlag('--platform');
    const slug = getFlag('--slug');
    const postFormat = getFlag('--post-format');

    if (!day || !platform || !slug || !postFormat) {
      console.error('Error: --day, --platform, --slug, and --post-format are all required');
      process.exit(1);
    }

    const strategy = readStrategy();
    const normDay = normalizeDay(day);

    // If no calendar exists yet (first run before weekly plan), create a default calendar
    if (!strategy.contentCalendar || strategy.contentCalendar.length === 0) {
      console.error('[STRATEGY] No calendar exists yet — creating default slots.');
      strategy.contentCalendar = [
        { day: 'Mon', platform: 'linkedin', slot: '09:00', slug: null, postFormat: null, status: 'open' },
        { day: 'Tue', platform: 'facebook', slot: '12:00', slug: null, postFormat: null, status: 'open' },
        { day: 'Wed', platform: 'linkedin', slot: '09:00', slug: null, postFormat: null, status: 'open' },
        { day: 'Thu', platform: 'facebook', slot: '12:00', slug: null, postFormat: null, status: 'open' },
        { day: 'Fri', platform: 'linkedin', slot: '09:00', slug: null, postFormat: null, status: 'open' },
      ];
    }

    const slot = strategy.contentCalendar.find(
      s => normalizeDay(s.day) === normDay &&
           s.platform.toLowerCase() === platform.toLowerCase() &&
           s.status === 'open'
    );

    if (!slot) {
      console.error(`Error: No open slot found for ${normDay}/${platform}`);
      process.exit(1);
    }

    slot.slug = slug;
    slot.postFormat = postFormat;
    slot.status = 'filled';
    writeStrategy(strategy, 'daily-social');
    console.error(`[STRATEGY] Filled ${day}/${platform}: ${slug} (${postFormat})`);
    console.log(JSON.stringify(slot, null, 2));
    break;
  }

  case 'add-insight': {
    const text = args[1];
    if (!text) { console.error('Error: insight text required'); process.exit(1); }
    const strategy = readStrategy();
    // Keep last 20 insights max
    strategy.monthlyInsights.push(text);
    if (strategy.monthlyInsights.length > 20) {
      strategy.monthlyInsights = strategy.monthlyInsights.slice(-20);
    }
    writeStrategy(strategy, 'monthly-social-review');
    console.error(`[STRATEGY] Insight added (${strategy.monthlyInsights.length} total).`);
    console.log(JSON.stringify({ added: text, total: strategy.monthlyInsights.length }));
    break;
  }

  case 'open-slots': {
    const strategy = readStrategy();
    const open = strategy.contentCalendar.filter(s => s.status === 'open');
    if (open.length === 0) {
      console.error('[STRATEGY] No open slots this week.');
    } else {
      console.error(`[STRATEGY] ${open.length} open slot(s):`);
    }
    console.log(JSON.stringify(open, null, 2));
    break;
  }

  case 'reset-week': {
    const weekOf = getFlag('--week-of') || new Date().toISOString().slice(0, 10);
    const strategy = readStrategy();
    strategy.weekOf = weekOf;
    // Reset all slots to open
    strategy.contentCalendar = [
      { day: 'Mon', platform: 'linkedin', slot: '09:00', slug: null, postFormat: null, status: 'open' },
      { day: 'Tue', platform: 'facebook', slot: '12:00', slug: null, postFormat: null, status: 'open' },
      { day: 'Wed', platform: 'linkedin', slot: '09:00', slug: null, postFormat: null, status: 'open' },
      { day: 'Thu', platform: 'facebook', slot: '12:00', slug: null, postFormat: null, status: 'open' },
      { day: 'Fri', platform: 'linkedin', slot: '09:00', slug: null, postFormat: null, status: 'open' },
    ];
    writeStrategy(strategy, 'weekly-social-plan');
    console.error(`[STRATEGY] Calendar reset for week of ${weekOf}.`);
    console.log(JSON.stringify(strategy.contentCalendar, null, 2));
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
