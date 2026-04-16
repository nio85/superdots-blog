#!/usr/bin/env node
/**
 * Reddit Ads API v3 wrapper
 *
 * Manages Reddit advertising campaigns via the Ads API.
 * Auth: OAuth2 with auto-refresh via REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REFRESH_TOKEN.
 *
 * Usage:
 *   node scripts/tools/reddit-ads.mjs <command> [options]
 */

import '../config.mjs';

const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const ADS_API_BASE = 'https://ads-api.reddit.com/api/v3';

const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.REDDIT_REFRESH_TOKEN;
const AD_ACCOUNT_ID = process.env.REDDIT_AD_ACCOUNT_ID;

let accessToken = null;
let tokenExpiresAt = 0;

const HELP = `Usage: node reddit-ads.mjs <command> [options]

Commands:
  auth                                   Refresh OAuth2 token, print expiry
  list-campaigns                         List all campaigns with status
  create-campaign <json>                 Create campaign (JSON: {name, objective, configured_status})
  get-campaign <id>                      Campaign details
  update-campaign <id> <json>            Update campaign fields
  pause-campaign <id>                    Pause a campaign
  resume-campaign <id>                   Resume a campaign
  list-ad-groups [campaignId]            List ad groups (optionally filter by campaign)
  create-ad-group <json>                 Create ad group (JSON: {name, campaign_id, bid_type, bid_strategy, ...})
  list-ads [adGroupId]                   List ads (optionally filter by ad group)
  create-ad <json>                       Create ad (JSON: {name, ad_group_id, post_id, configured_status})
  pause-ad <adId>                        Pause an ad
  list-posts                             List posts for the ad profile
  create-post <json>                     Create post (JSON: {type, headline, content: [{destination_url, call_to_action, media_url}]})
  get-profiles                           List ad profiles for the account
  report <campaignId> [--days N]         Campaign performance report
  account-report [--days N]              Account-level spend summary

Options:
  --json    Output as JSON
  --days N  Lookback period in days (default 7)
  --help    Show this help`;

const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) { console.log(HELP); process.exit(0); }

const jsonOutput = args.includes('--json');
const command = args.find(a => !a.startsWith('--'));
const positional = args.filter(a => !a.startsWith('--'));

function getOpt(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--') ? args[idx + 1] : null;
}

function log(...a) { if (!jsonOutput) console.log(...a); }
function out(data) { console.log(JSON.stringify(data, null, 2)); }
function err(msg) { console.error(`Error: ${msg}`); process.exit(1); }

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  err('Missing env vars: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REFRESH_TOKEN');
}
if (!AD_ACCOUNT_ID && command !== 'auth') {
  err('Missing env var: REDDIT_AD_ACCOUNT_ID');
}

async function refreshAccessToken() {
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(REDDIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'superdots-ads/1.0',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: REFRESH_TOKEN }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return data;
}

async function ensureToken() {
  if (!accessToken || Date.now() >= tokenExpiresAt) {
    await refreshAccessToken();
  }
}

async function api(method, path, body = null) {
  await ensureToken();
  const url = `${ADS_API_BASE}${path}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'superdots-ads/1.0',
    },
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res = await fetch(url, opts);

  if (res.status === 401) {
    await refreshAccessToken();
    opts.headers['Authorization'] = `Bearer ${accessToken}`;
    res = await fetch(url, opts);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return { status: res.status, message: await res.text() };
}

function parseJsonArg(idx) {
  const raw = positional[idx];
  if (!raw) err(`Missing JSON argument at position ${idx}`);
  try { return JSON.parse(raw); } catch { err(`Invalid JSON: ${raw}`); }
}

const days = parseInt(getOpt('days') || '7', 10);

function isoDate(daysAgo) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];
}

async function main() {
  switch (command) {
    case 'auth': {
      const data = await refreshAccessToken();
      const result = {
        access_token: accessToken.slice(0, 8) + '...',
        expires_in: data.expires_in,
        scope: data.scope,
        token_type: data.token_type,
      };
      if (jsonOutput) { out(result); break; }
      log('Token refreshed successfully.');
      log(`  Expires in: ${data.expires_in}s`);
      log(`  Scope: ${data.scope}`);
      break;
    }

    case 'list-campaigns': {
      const data = await api('GET', `/ad_accounts/${AD_ACCOUNT_ID}/campaigns`);
      if (jsonOutput) { out(data); break; }
      const campaigns = data.data || data || [];
      log(`Campaigns (${Array.isArray(campaigns) ? campaigns.length : '?'}):`);
      for (const c of (Array.isArray(campaigns) ? campaigns : [])) {
        log(`  [${c.configured_status || c.effective_status}] ${c.name} (id: ${c.id})`);
      }
      break;
    }

    case 'create-campaign': {
      const body = parseJsonArg(1);
      body.configured_status = body.configured_status || body.status || 'PAUSED';
      delete body.status;
      body.objective = body.objective || 'TRAFFIC';
      const data = await api('POST', `/ad_accounts/${AD_ACCOUNT_ID}/campaigns`, { data: body });
      if (jsonOutput) { out(data); break; }
      log(`Campaign created: ${data.data?.id || data.id || JSON.stringify(data)}`);
      break;
    }

    case 'get-campaign': {
      const id = positional[1];
      if (!id) err('Missing campaign ID');
      const data = await api('GET', `/campaigns/${id}`);
      if (jsonOutput) { out(data); break; }
      const c = data.data || data;
      log(`Campaign: ${c.name}`);
      log(`  Status: ${c.status || c.effective_status}`);
      log(`  Budget: ${(c.daily_budget_micro || 0) / 1000000}/day`);
      log(`  Objective: ${c.objective}`);
      break;
    }

    case 'update-campaign': {
      const id = positional[1];
      if (!id) err('Missing campaign ID');
      const body = parseJsonArg(2);
      const data = await api('PATCH', `/campaigns/${id}`, { data: body });
      if (jsonOutput) { out(data); break; }
      log(`Campaign ${id} updated.`);
      break;
    }

    case 'pause-campaign': {
      const id = positional[1];
      if (!id) err('Missing campaign ID');
      const data = await api('PATCH', `/campaigns/${id}`, { data: { configured_status: 'PAUSED' } });
      if (jsonOutput) { out(data); break; }
      log(`Campaign ${id} paused.`);
      break;
    }

    case 'resume-campaign': {
      const id = positional[1];
      if (!id) err('Missing campaign ID');
      const data = await api('PATCH', `/campaigns/${id}`, { data: { configured_status: 'ACTIVE' } });
      if (jsonOutput) { out(data); break; }
      log(`Campaign ${id} resumed.`);
      break;
    }

    case 'list-ad-groups': {
      const campaignId = positional[1];
      const data = await api('GET', `/ad_accounts/${AD_ACCOUNT_ID}/ad_groups`);
      if (jsonOutput) { out(data); break; }
      let groups = data.data || data || [];
      if (campaignId && Array.isArray(groups)) groups = groups.filter(g => g.campaign_id === campaignId);
      log(`Ad groups (${Array.isArray(groups) ? groups.length : '?'}):`);
      for (const g of (Array.isArray(groups) ? groups : [])) {
        log(`  [${g.configured_status}] ${g.name} (id: ${g.id}) campaign: ${g.campaign_id}`);
      }
      break;
    }

    case 'create-ad-group': {
      const body = parseJsonArg(1);
      body.configured_status = body.configured_status || body.status || 'PAUSED';
      delete body.status;
      const data = await api('POST', `/ad_accounts/${AD_ACCOUNT_ID}/ad_groups`, { data: body });
      if (jsonOutput) { out(data); break; }
      log(`Ad group created: ${data.data?.id || data.id || JSON.stringify(data)}`);
      break;
    }

    case 'list-ads': {
      const adGroupId = positional[1];
      const data = await api('GET', `/ad_accounts/${AD_ACCOUNT_ID}/ads`);
      if (jsonOutput) { out(data); break; }
      let ads = data.data || data || [];
      if (adGroupId && Array.isArray(ads)) ads = ads.filter(a => a.ad_group_id === adGroupId);
      log(`Ads (${Array.isArray(ads) ? ads.length : '?'}):`);
      for (const a of (Array.isArray(ads) ? ads : [])) {
        log(`  [${a.configured_status}] ${a.name || a.headline} (id: ${a.id}) ad_group: ${a.ad_group_id}`);
      }
      break;
    }

    case 'create-ad': {
      const body = parseJsonArg(1);
      body.configured_status = body.configured_status || body.status || 'PAUSED';
      delete body.status;
      const data = await api('POST', `/ad_accounts/${AD_ACCOUNT_ID}/ads`, { data: body });
      if (jsonOutput) { out(data); break; }
      log(`Ad created: ${data.data?.id || data.id || JSON.stringify(data)}`);
      break;
    }

    case 'pause-ad': {
      const adId = positional[1];
      if (!adId) err('Missing ad ID');
      const data = await api('PATCH', `/ads/${adId}`, { data: { configured_status: 'PAUSED' } });
      if (jsonOutput) { out(data); break; }
      log(`Ad ${adId} paused.`);
      break;
    }

    case 'get-profiles': {
      const data = await api('GET', `/ad_accounts/${AD_ACCOUNT_ID}/profiles`);
      if (jsonOutput) { out(data); break; }
      const profiles = data.data || [];
      log(`Profiles (${Array.isArray(profiles) ? profiles.length : '?'}):`);
      for (const p of (Array.isArray(profiles) ? profiles : [])) {
        log(`  ${p.name || p.username} (id: ${p.id})`);
      }
      break;
    }

    case 'list-posts': {
      const profileId = positional[1] || getOpt('profile');
      if (!profileId) {
        const profiles = await api('GET', `/ad_accounts/${AD_ACCOUNT_ID}/profiles`);
        const pList = profiles.data || [];
        if (!Array.isArray(pList) || pList.length === 0) err('No profiles found');
        const data = await api('GET', `/profiles/${pList[0].id}/posts`);
        if (jsonOutput) { out(data); break; }
        const posts = data.data || [];
        log(`Posts (${Array.isArray(posts) ? posts.length : '?'}):`);
        for (const p of (Array.isArray(posts) ? posts : [])) {
          log(`  [${p.type}] ${p.headline} (id: ${p.id})`);
        }
      } else {
        const data = await api('GET', `/profiles/${profileId}/posts`);
        if (jsonOutput) { out(data); break; }
        const posts = data.data || [];
        log(`Posts (${Array.isArray(posts) ? posts.length : '?'}):`);
        for (const p of (Array.isArray(posts) ? posts : [])) {
          log(`  [${p.type}] ${p.headline} (id: ${p.id})`);
        }
      }
      break;
    }

    case 'create-post': {
      const profileId = positional[1] && !positional[1].startsWith('{') ? positional[1] : null;
      const bodyIdx = profileId ? 2 : 1;
      const body = parseJsonArg(bodyIdx);
      let pid = profileId;
      if (!pid) {
        const profiles = await api('GET', `/ad_accounts/${AD_ACCOUNT_ID}/profiles`);
        const pList = profiles.data || [];
        if (!Array.isArray(pList) || pList.length === 0) err('No profiles found');
        pid = pList[0].id;
      }
      const data = await api('POST', `/profiles/${pid}/posts`, { data: body });
      if (jsonOutput) { out(data); break; }
      log(`Post created: ${data.data?.id || data.id || JSON.stringify(data)}`);
      break;
    }

    case 'report': {
      const campaignId = positional[1];
      if (!campaignId) err('Missing campaign ID');
      const data = await api('POST', `/ad_accounts/${AD_ACCOUNT_ID}/reports`, { data: {
        starts_at: `${isoDate(days)}T00:00:00Z`,
        ends_at: `${isoDate(0)}T00:00:00Z`,
        breakdowns: ['CAMPAIGN_ID', 'DATE'],
        fields: ['IMPRESSIONS', 'CLICKS', 'CPC', 'CTR', 'SPEND', 'ECPM'],
        filter: `campaign:id==${campaignId}`,
      }});
      if (jsonOutput) { out(data); break; }
      const rows = data.data?.metrics || data.data || [];
      log(`Campaign ${campaignId} report (${days}d):`);
      let totalSpend = 0, totalClicks = 0, totalImpr = 0;
      for (const r of (Array.isArray(rows) ? rows : [])) {
        const spend = parseFloat(r.SPEND || r.spend || 0);
        totalSpend += spend;
        totalClicks += parseInt(r.CLICKS || r.clicks || 0, 10);
        totalImpr += parseInt(r.IMPRESSIONS || r.impressions || 0, 10);
        log(`  ${r.DATE || r.date}: ${r.IMPRESSIONS || 0} impr, ${r.CLICKS || 0} clicks, €${spend.toFixed(2)} spend`);
      }
      const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const ctr = totalImpr > 0 ? (totalClicks / totalImpr * 100) : 0;
      log(`  Total: ${totalImpr} impr, ${totalClicks} clicks, €${totalSpend.toFixed(2)} spend`);
      log(`  Avg CPC: €${avgCpc.toFixed(2)}, CTR: ${ctr.toFixed(2)}%`);
      break;
    }

    case 'account-report': {
      const data = await api('POST', `/ad_accounts/${AD_ACCOUNT_ID}/reports`, { data: {
        starts_at: `${isoDate(days)}T00:00:00Z`,
        ends_at: `${isoDate(0)}T00:00:00Z`,
        breakdowns: ['DATE'],
        fields: ['IMPRESSIONS', 'CLICKS', 'CPC', 'CTR', 'SPEND', 'ECPM'],
      }});
      if (jsonOutput) { out(data); break; }
      const rows = data.data?.metrics || data.data || [];
      log(`Account report (${days}d):`);
      let totalSpend = 0;
      for (const r of (Array.isArray(rows) ? rows : [])) {
        const spend = parseFloat(r.SPEND || r.spend || 0);
        totalSpend += spend;
        log(`  ${r.DATE || r.date}: ${r.IMPRESSIONS || 0} impr, ${r.CLICKS || 0} clicks, €${spend.toFixed(2)}`);
      }
      log(`  Total spend: €${totalSpend.toFixed(2)}`);
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
