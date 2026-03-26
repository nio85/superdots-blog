#!/usr/bin/env node
/**
 * Mautic API wrapper
 *
 * Interacts with Mautic (localhost:8880) for contact and campaign management.
 * Auth: HTTP Basic with MAUTIC_USERNAME and MAUTIC_PASSWORD env vars.
 *
 * Usage:
 *   node scripts/tools/mautic-api.mjs <command> [options]
 */

import '../config.mjs';

// Mautic forces HTTPS redirect on localhost, so use tunnel URL with CF Access headers
const MAUTIC_URL = process.env.MAUTIC_API_URL || 'https://mautic.bartoccini.cloud';
const MAUTIC_USERNAME = process.env.MAUTIC_USERNAME;
const MAUTIC_PASSWORD = process.env.MAUTIC_PASSWORD;
const CF_ACCESS_CLIENT_ID = process.env.CF_ACCESS_CLIENT_ID;
const CF_ACCESS_CLIENT_SECRET = process.env.CF_ACCESS_CLIENT_SECRET;

const HELP = `Usage: node mautic-api.mjs <command> [options]

Commands:
  contacts [--search query]                       List/search contacts
  contact <id>                                    Get contact details
  create-contact <email> [--firstname n] [--lastname n]  Create contact
  update-contact <id> <json>                      Update contact fields
  delete-contact <id>                             Delete a contact
  dnc-add <id>                                    Add to Do Not Contact
  dnc-remove <id>                                 Remove from Do Not Contact
  segments                                        List segments
  add-to-segment <contactId> <segmentId>          Add contact to segment
  campaigns                                       List campaigns
  add-note <contactId> <text>                     Add note to contact
  fields                                          List contact fields

Options:
  --json    Output as JSON
  --help    Show this help`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) { console.log(HELP); process.exit(0); }

const jsonOutput = args.includes('--json');
const command = args.find(a => !a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

function log(...a) { if (!jsonOutput) console.log(...a); }
function out(data) { console.log(JSON.stringify(data, null, 2)); }
function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

if (!MAUTIC_USERNAME || !MAUTIC_PASSWORD) err('Missing env vars MAUTIC_USERNAME and/or MAUTIC_PASSWORD');

const baseUrl = MAUTIC_URL.replace(/\/$/, '');
const authHeader = 'Basic ' + Buffer.from(`${MAUTIC_USERNAME}:${MAUTIC_PASSWORD}`).toString('base64');

async function api(method, path, body) {
  const url = `${baseUrl}${path}`;
  const opts = {
    method,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      ...(CF_ACCESS_CLIENT_ID && { 'CF-Access-Client-Id': CF_ACCESS_CLIENT_ID }),
      ...(CF_ACCESS_CLIENT_SECRET && { 'CF-Access-Client-Secret': CF_ACCESS_CLIENT_SECRET }),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    const detail = typeof data === 'object' ? JSON.stringify(data) : data;
    throw new Error(`${method} ${path} → ${res.status}: ${detail}`);
  }
  return data;
}

async function main() {
  switch (command) {
    case 'contacts': {
      const search = getFlag('--search') || '';
      const path = search
        ? `/api/contacts?search=${encodeURIComponent(search)}`
        : '/api/contacts';
      const data = await api('GET', path);
      if (jsonOutput) { out(data); break; }
      const contacts = data.contacts || {};
      const list = Object.values(contacts);
      if (list.length === 0) { log('No contacts found.'); break; }
      for (const c of list) {
        const f = c.fields?.all || c.fields?.core || {};
        log(`  ${c.id}  ${f.email || '?'}  ${f.firstname || ''} ${f.lastname || ''}`);
      }
      log(`Total: ${data.total || list.length}`);
      break;
    }
    case 'contact': {
      const id = positional[1];
      if (!id) err('Usage: mautic-api.mjs contact <id>');
      const data = await api('GET', `/api/contacts/${id}`);
      if (jsonOutput) { out(data); break; }
      const c = data.contact || data;
      const f = c.fields?.all || c.fields?.core || {};
      log(`ID:    ${c.id}`);
      log(`Email: ${f.email || '?'}`);
      log(`Name:  ${f.firstname || ''} ${f.lastname || ''}`);
      log(`Tags:  ${(c.tags || []).map(t => t.tag || t).join(', ') || 'none'}`);
      log(`DNC:   ${(c.doNotContact || []).length > 0 ? 'yes' : 'no'}`);
      break;
    }
    case 'create-contact': {
      const email = positional[1];
      if (!email) err('Usage: mautic-api.mjs create-contact <email> [--firstname n] [--lastname n]');
      const body = { email };
      const firstname = getFlag('--firstname');
      const lastname = getFlag('--lastname');
      if (firstname) body.firstname = firstname;
      if (lastname) body.lastname = lastname;
      const data = await api('POST', '/api/contacts/new', body);
      if (jsonOutput) { out(data); break; }
      log(`Contact created: ${data.contact?.id || JSON.stringify(data)}`);
      break;
    }
    case 'update-contact': {
      const id = positional[1];
      const jsonStr = positional[2];
      if (!id || !jsonStr) err('Usage: mautic-api.mjs update-contact <id> \'{"field":"value"}\'');
      let body;
      try { body = JSON.parse(jsonStr); } catch { err('Invalid JSON for update body'); }
      const data = await api('PATCH', `/api/contacts/${id}/edit`, body);
      if (jsonOutput) { out(data); break; }
      log(`Contact ${id} updated.`);
      break;
    }
    case 'delete-contact': {
      const id = positional[1];
      if (!id) err('Usage: mautic-api.mjs delete-contact <id>');
      const data = await api('DELETE', `/api/contacts/${id}/delete`);
      if (jsonOutput) { out(data); break; }
      log(`Contact ${id} deleted.`);
      break;
    }
    case 'dnc-add': {
      const id = positional[1];
      if (!id) err('Usage: mautic-api.mjs dnc-add <id>');
      const data = await api('POST', `/api/contacts/${id}/dnc/email/add`);
      if (jsonOutput) { out(data); break; }
      log(`Contact ${id} added to Do Not Contact.`);
      break;
    }
    case 'dnc-remove': {
      const id = positional[1];
      if (!id) err('Usage: mautic-api.mjs dnc-remove <id>');
      const data = await api('POST', `/api/contacts/${id}/dnc/email/remove`);
      if (jsonOutput) { out(data); break; }
      log(`Contact ${id} removed from Do Not Contact.`);
      break;
    }
    case 'segments': {
      const data = await api('GET', '/api/segments');
      if (jsonOutput) { out(data); break; }
      const lists = data.lists || data.segments || {};
      const items = Object.values(lists);
      if (items.length === 0) { log('No segments.'); break; }
      for (const s of items) {
        log(`  ${s.id}  ${s.name}  (${s.alias || ''})  contacts: ${s.contactCount ?? '?'}`);
      }
      break;
    }
    case 'add-to-segment': {
      const contactId = positional[1];
      const segmentId = positional[2];
      if (!contactId || !segmentId) err('Usage: mautic-api.mjs add-to-segment <contactId> <segmentId>');
      const data = await api('POST', `/api/segments/${segmentId}/contact/${contactId}/add`);
      if (jsonOutput) { out(data); break; }
      log(`Contact ${contactId} added to segment ${segmentId}.`);
      break;
    }
    case 'campaigns': {
      const data = await api('GET', '/api/campaigns');
      if (jsonOutput) { out(data); break; }
      const campaigns = data.campaigns || {};
      const items = Object.values(campaigns);
      if (items.length === 0) { log('No campaigns.'); break; }
      for (const c of items) {
        log(`  ${c.id}  ${c.name}  (${c.isPublished ? 'published' : 'draft'})  contacts: ${c.contactCount ?? '?'}`);
      }
      break;
    }
    case 'add-note': {
      const contactId = positional[1];
      const text = positional.slice(2).join(' ');
      if (!contactId || !text) err('Usage: mautic-api.mjs add-note <contactId> <text>');
      const data = await api('POST', '/api/notes/new', { lead: contactId, body: text, type: 'general' });
      if (jsonOutput) { out(data); break; }
      log(`Note added to contact ${contactId}.`);
      break;
    }
    case 'fields': {
      const data = await api('GET', '/api/contacts/list/fields');
      if (jsonOutput) { out(data); break; }
      const fields = Array.isArray(data) ? data : Object.values(data);
      for (const f of fields) {
        log(`  ${f.alias || f.id}  (${f.type || '?'})  ${f.label || ''}`);
      }
      break;
    }
    default:
      err(`Unknown command: ${command}\nRun with --help for usage.`);
  }
}

main().catch(e => {
  if (jsonOutput) { out({ error: e.message }); } else { console.error(e.message); }
  process.exit(1);
});
