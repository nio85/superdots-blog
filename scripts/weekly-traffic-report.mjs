#!/usr/bin/env node
/**
 * Weekly Traffic & Search Performance Report
 *
 * Pulls data from three sources and builds a unified markdown report.
 *
 * Usage:
 *   node scripts/weekly-traffic-report.mjs [--post]
 *
 * Flags:
 *   --post   Post the report as a comment on SUP-197 via Paperclip API
 *   --email  Send the report as a styled HTML email to the board
 *
 * Data sources:
 *   - Cloudflare Analytics GraphQL API (server-side, all traffic incl. bots)
 *   - GA4 Data API (human traffic only, consent-gated)
 *   - Google Search Console API (search impressions, clicks, CTR, position)
 *
 * Env vars required:
 *   CLOUDFLARE_API_TOKEN — with Analytics:Read permission
 *   GCP_KEY_FILE (optional) — path to service account JSON, defaults to .secrets/gdrive-service-account.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE_URL,
  CF_ACCOUNT_ID,
  PAPERCLIP_API_URL,
  getPaperclipApiKey,
  SMTP_USER,
  SMTP_PASS,
  TO_EMAIL,
  createSmtpTransport,
} from './config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = '/tmp/weekly-report-data';
const SUP_197_ID = '70b6cf36-6464-435d-a64c-f37b32b1195e';
const CF_ZONE_ID = '3d468514d9fe7a1716404c16f05818d8';
const CF_GQL = 'https://api.cloudflare.com/client/v4/graphql';

const GCP_KEY_FILE = process.env.GCP_KEY_FILE
  || resolve(__dirname, '..', '..', '.secrets', 'gdrive-service-account.json');
const GA4_PROPERTY_ID = '528512942';
const GSC_SITE_URL = 'sc-domain:superdots.sh';

// --- Helpers ---

function fmtDate(d) { return d.toISOString().slice(0, 10); }

function weekRange() {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  return { start: fmtDate(start), end: fmtDate(end) };
}

function prevWeekRange() {
  const now = new Date();
  const end = new Date(now);
  end.setDate(now.getDate() - 7);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { start: fmtDate(start), end: fmtDate(end) };
}

function fmtNum(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US');
}

function pctChange(current, previous) {
  if (!previous || previous === 0) return current > 0 ? 'new' : '—';
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

function fmtDuration(seconds) {
  if (!seconds || seconds === 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// --- Google Auth ---

let _google = null;
async function getGoogle() {
  if (_google) return _google;
  try {
    const mod = await import('googleapis');
    _google = mod.google;
    return _google;
  } catch {
    return null;
  }
}

async function getGoogleAuth(scopes) {
  const google = await getGoogle();
  if (!google || !existsSync(GCP_KEY_FILE)) return null;
  return new google.auth.GoogleAuth({ keyFile: GCP_KEY_FILE, scopes });
}

// --- Cloudflare GraphQL ---

async function cfQuery(query) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN not set');
  const res = await fetch(CF_GQL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Cloudflare GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

async function fetchTrafficData(startDate, endDate) {
  const data = await cfQuery(`{
    viewer {
      zones(filter: {zoneTag: "${CF_ZONE_ID}"}) {
        httpRequests1dGroups(
          limit: 10
          filter: {date_geq: "${startDate}", date_leq: "${endDate}"}
          orderBy: [date_ASC]
        ) {
          dimensions { date }
          sum {
            requests
            pageViews
            bytes
            countryMap { clientCountryName requests }
            browserMap { uaBrowserFamily pageViews }
          }
          uniq { uniques }
        }
      }
    }
  }`);
  return data.viewer.zones[0].httpRequests1dGroups;
}

function aggregateDays(days) {
  const totals = { requests: 0, pageViews: 0, uniques: 0, bytes: 0 };
  const countries = {};
  const browsers = {};

  for (const day of days) {
    totals.requests += day.sum.requests;
    totals.pageViews += day.sum.pageViews;
    totals.uniques += day.uniq.uniques;
    totals.bytes += day.sum.bytes;

    for (const c of day.sum.countryMap || []) {
      countries[c.clientCountryName] = (countries[c.clientCountryName] || 0) + c.requests;
    }
    for (const b of day.sum.browserMap || []) {
      browsers[b.uaBrowserFamily] = (browsers[b.uaBrowserFamily] || 0) + b.pageViews;
    }
  }

  return { totals, countries, browsers, days };
}

// --- GA4 Data API ---

async function fetchGA4Data(startDate, endDate, prevStartDate, prevEndDate) {
  const google = await getGoogle();
  const auth = await getGoogleAuth(['https://www.googleapis.com/auth/analytics.readonly']);
  if (!auth) return null;

  try {
    const client = await auth.getClient();
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth: client });
    const property = `properties/${GA4_PROPERTY_ID}`;

    // Overall metrics with comparison
    const [summaryRes, pagesRes, sourcesRes] = await Promise.all([
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges: [
            { startDate, endDate },
            { startDate: prevStartDate, endDate: prevEndDate },
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
          ],
        },
      }),
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'totalUsers' },
            { name: 'averageSessionDuration' },
          ],
          dimensions: [{ name: 'pagePath' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 10,
        },
      }),
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
          ],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10,
        },
      }),
    ]);

    // Parse summary (current = date_range_0, previous = date_range_1)
    const summary = { current: {}, previous: {} };
    const metricNames = ['sessions', 'totalUsers', 'screenPageViews', 'averageSessionDuration', 'bounceRate'];
    for (const row of summaryRes.data.rows || []) {
      const range = row.dimensionValues?.[0]?.value;
      const target = range === 'date_range_1' ? summary.previous : summary.current;
      for (let i = 0; i < metricNames.length; i++) {
        target[metricNames[i]] = (target[metricNames[i]] || 0) + parseFloat(row.metricValues[i].value);
      }
    }

    // Parse top pages
    const topPages = (pagesRes.data.rows || []).map(r => ({
      path: r.dimensionValues[0].value,
      pageViews: parseInt(r.metricValues[0].value),
      users: parseInt(r.metricValues[1].value),
      avgDuration: parseFloat(r.metricValues[2].value),
    }));

    // Parse traffic sources
    const sources = (sourcesRes.data.rows || []).map(r => ({
      channel: r.dimensionValues[0].value,
      sessions: parseInt(r.metricValues[0].value),
      users: parseInt(r.metricValues[1].value),
    }));

    return { summary, topPages, sources };
  } catch (e) {
    console.error('GA4 fetch error:', e.message);
    return null;
  }
}

// --- Google Search Console ---

async function fetchGSCData(startDate, endDate) {
  const google = await getGoogle();
  const auth = await getGoogleAuth(['https://www.googleapis.com/auth/webmasters.readonly']);
  if (!auth) return null;

  try {
    const client = await auth.getClient();
    const searchconsole = google.searchconsole({ version: 'v1', auth: client });

    const [queriesRes, pagesRes] = await Promise.all([
      searchconsole.searchanalytics.query({
        siteUrl: GSC_SITE_URL,
        requestBody: {
          startDate, endDate,
          dimensions: ['query'],
          rowLimit: 20,
        },
      }),
      searchconsole.searchanalytics.query({
        siteUrl: GSC_SITE_URL,
        requestBody: {
          startDate, endDate,
          dimensions: ['page'],
          rowLimit: 10,
        },
      }),
    ]);

    const totalsRes = await searchconsole.searchanalytics.query({
      siteUrl: GSC_SITE_URL,
      requestBody: { startDate, endDate },
    });

    const queries = (queriesRes.data.rows || []).map(r => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));

    const pages = (pagesRes.data.rows || []).map(r => ({
      page: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));

    // Content gaps: high impressions, low CTR
    const contentGaps = queries
      .filter(q => q.impressions >= 5 && q.ctr < 0.03)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5);

    return {
      totals: totalsRes.data.rows?.[0] || null,
      queries: queries.slice(0, 10),
      pages,
      contentGaps,
    };
  } catch (e) {
    console.error('GSC fetch error:', e.message);
    return null;
  }
}

// --- Report Sections ---

function cfTrafficTable(current, previous) {
  const c = current.totals;
  const p = previous?.totals || {};
  return `| Metric | This Week | Previous Week | Change |
|--------|-----------|---------------|--------|
| Page Views | ${fmtNum(c.pageViews)} | ${fmtNum(p.pageViews)} | ${pctChange(c.pageViews, p.pageViews)} |
| Unique Visitors | ${fmtNum(c.uniques)} | ${fmtNum(p.uniques)} | ${pctChange(c.uniques, p.uniques)} |
| Total Requests | ${fmtNum(c.requests)} | ${fmtNum(p.requests)} | ${pctChange(c.requests, p.requests)} |
| Bandwidth | ${(c.bytes / 1024 / 1024).toFixed(1)} MB | ${p.bytes ? (p.bytes / 1024 / 1024).toFixed(1) + ' MB' : '—'} | ${pctChange(c.bytes, p.bytes)} |
`;
}

function ga4SummaryTable(ga4) {
  if (!ga4) return '> *GA4 API not available.*\n';
  const c = ga4.summary.current;
  const p = ga4.summary.previous;
  return `| Metric | This Week | Previous Week | Change |
|--------|-----------|---------------|--------|
| Sessions | ${fmtNum(Math.round(c.sessions || 0))} | ${fmtNum(Math.round(p.sessions || 0))} | ${pctChange(c.sessions, p.sessions)} |
| Users | ${fmtNum(Math.round(c.totalUsers || 0))} | ${fmtNum(Math.round(p.totalUsers || 0))} | ${pctChange(c.totalUsers, p.totalUsers)} |
| Page Views | ${fmtNum(Math.round(c.screenPageViews || 0))} | ${fmtNum(Math.round(p.screenPageViews || 0))} | ${pctChange(c.screenPageViews, p.screenPageViews)} |
| Avg Session Duration | ${fmtDuration(c.averageSessionDuration)} | ${fmtDuration(p.averageSessionDuration)} | ${pctChange(c.averageSessionDuration, p.averageSessionDuration)} |
| Bounce Rate | ${((c.bounceRate || 0) * 100).toFixed(1)}% | ${((p.bounceRate || 0) * 100).toFixed(1)}% | — |
`;
}

function ga4TopPagesTable(ga4) {
  if (!ga4?.topPages?.length) return '> *No page data available yet.*\n';
  let md = '| Page | Views | Users | Avg Time |\n|------|-------|-------|----------|\n';
  for (const p of ga4.topPages) {
    md += `| ${p.path} | ${fmtNum(p.pageViews)} | ${fmtNum(p.users)} | ${fmtDuration(p.avgDuration)} |\n`;
  }
  return md;
}

function ga4SourcesTable(ga4) {
  if (!ga4?.sources?.length) return '> *No source data available yet.*\n';
  const totalSessions = ga4.sources.reduce((sum, s) => sum + s.sessions, 0);
  let md = '| Channel | Sessions | Users | % of Total |\n|---------|----------|-------|------------|\n';
  for (const s of ga4.sources) {
    md += `| ${s.channel} | ${fmtNum(s.sessions)} | ${fmtNum(s.users)} | ${((s.sessions / totalSessions) * 100).toFixed(1)}% |\n`;
  }
  return md;
}

function gscSection(gsc) {
  if (!gsc) return '> *GSC API not available or no data yet. Sitemaps submitted — data typically appears 2-3 days after submission.*\n';
  if (!gsc.queries.length && !gsc.totals) {
    return '> *GSC connected but no search data yet. Site was recently verified and sitemaps submitted. Google needs 2-3 days to start reporting impressions. Check back next week.*\n';
  }

  let md = '';

  // Totals
  if (gsc.totals) {
    md += `**Overall:** ${fmtNum(gsc.totals.clicks)} clicks, ${fmtNum(gsc.totals.impressions)} impressions, ${(gsc.totals.ctr * 100).toFixed(1)}% CTR, avg position ${gsc.totals.position.toFixed(1)}\n\n`;
  }

  // Top queries
  if (gsc.queries.length) {
    md += '**Top Search Queries:**\n\n';
    md += '| Query | Clicks | Impressions | CTR | Position |\n|-------|--------|-------------|-----|----------|\n';
    for (const q of gsc.queries) {
      md += `| ${q.query} | ${q.clicks} | ${q.impressions} | ${(q.ctr * 100).toFixed(1)}% | ${q.position.toFixed(1)} |\n`;
    }
    md += '\n';
  }

  // Content gaps
  if (gsc.contentGaps?.length) {
    md += '**Content Gaps** (high impressions, low CTR — title/meta optimization opportunities):\n\n';
    md += '| Query | Impressions | CTR | Position |\n|-------|-------------|-----|----------|\n';
    for (const q of gsc.contentGaps) {
      md += `| ${q.query} | ${q.impressions} | ${(q.ctr * 100).toFixed(1)}% | ${q.position.toFixed(1)} |\n`;
    }
    md += '\n';
  }

  return md;
}

function countryTable(current) {
  const sorted = Object.entries(current.countries).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!sorted.length) return '> *No country data available.*\n';
  const totalReqs = current.totals.requests;
  let md = '| Country | Requests | % of Total |\n|---------|----------|------------|\n';
  for (const [country, reqs] of sorted) {
    md += `| ${country} | ${fmtNum(reqs)} | ${((reqs / totalReqs) * 100).toFixed(1)}% |\n`;
  }
  return md;
}

// --- Build Report ---

function buildReport(cfCurrent, cfPrevious, ga4, gsc, week) {
  const botPV = cfCurrent.browsers['Unknown'] || 0;
  const humanPV = cfCurrent.totals.pageViews - botPV;
  const botPct = cfCurrent.totals.pageViews > 0
    ? ((botPV / cfCurrent.totals.pageViews) * 100).toFixed(0)
    : 0;
  const ga4PV = ga4 ? Math.round(ga4.summary.current.screenPageViews || 0) : null;

  return `## Weekly Traffic Report — ${week.start} to ${week.end}

### GA4 — Human Traffic (consent-gated)

${ga4SummaryTable(ga4)}
${ga4PV != null ? `> GA4 tracks only real browser sessions with consent. This is the source of truth for human traffic.` : ''}

### Top Pages (GA4)

${ga4TopPagesTable(ga4)}
### Traffic Sources (GA4)

${ga4SourcesTable(ga4)}
### Search Console Highlights

${gscSection(gsc)}
### Cloudflare — All Traffic (incl. bots)

${cfTrafficTable(cfCurrent, cfPrevious)}
> Cloudflare counts all HTTP requests (bots, crawlers, agents). Estimated bot page views: **${fmtNum(botPV)}** (${botPct}% of CF total).${ga4PV != null ? ` GA4 human page views: **${fmtNum(ga4PV)}** — the gap (${fmtNum(cfCurrent.totals.pageViews - ga4PV)}) is bot/agent traffic.` : ''}

### Top Countries (Cloudflare)

${countryTable(cfCurrent)}
### Actionable Recommendations

${buildRecommendations(cfCurrent, ga4, gsc, botPct)}
---
*Report generated ${new Date().toISOString().slice(0, 16)} UTC — [SUP-197](/SUP/issues/SUP-197)*`;
}

function buildRecommendations(cf, ga4, gsc, botPct) {
  const recs = [];

  if (!gsc || !gsc.queries.length) {
    recs.push('**Monitor GSC indexing** — sitemaps submitted, but no search data yet. Google typically needs 2-3 days to start reporting. If no data by next report, investigate indexing issues.');
  }

  if (gsc?.contentGaps?.length) {
    recs.push(`**Optimize titles/meta for ${gsc.contentGaps.length} content gaps** — queries with high impressions but low CTR. @SEOExpert and @Copywriter should review title tags and meta descriptions for these pages.`);
  }

  if (ga4) {
    const br = ga4.summary.current.bounceRate || 0;
    if (br > 0.7) {
      recs.push(`**Reduce bounce rate** (currently ${(br * 100).toFixed(0)}%) — high bounce suggests content doesn't match search intent or UX needs improvement. Check top landing pages.`);
    }
  }

  if (parseInt(botPct) > 60) {
    recs.push(`**Bot traffic is ${botPct}% of Cloudflare page views** — consider adding bot filtering rules in Cloudflare if this is causing performance issues.`);
  }

  if (ga4?.sources?.length) {
    const organic = ga4.sources.find(s => s.channel === 'Organic Search');
    if (!organic || organic.sessions < 5) {
      recs.push('**Organic search traffic is minimal** — expected for a new site. Focus on building backlinks, ensuring all pages are indexed, and publishing content targeting high-volume keywords.');
    }
  }

  if (!recs.length) {
    recs.push('**All systems nominal** — continue publishing and monitoring. GSC data will become richer as the site ages and gets indexed.');
  }

  return recs.map((r, i) => `${i + 1}. ${r}`).join('\n');
}

// --- HTML Email Builder ---

function buildHtmlEmail(cfCurrent, cfPrevious, ga4, gsc, week) {
  const RED = '#E8363B';
  const NAVY = '#0B1222';
  const NAVY_LIGHT = '#1E293B';
  const TEAL = '#14B8A6';
  const GRAY_50 = '#F8FAFC';
  const GRAY_100 = '#F1F5F9';
  const GRAY_200 = '#E2E8F0';
  const GRAY_400 = '#94A3B8';
  const GRAY_500 = '#64748B';
  const GRAY_700 = '#334155';
  const GRAY_900 = '#0F172A';

  const FONT = "'Inter','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
  const FONT_DISPLAY = "'Space Grotesk','Inter','Segoe UI',Roboto,Arial,sans-serif";

  const botPV = cfCurrent.browsers['Unknown'] || 0;
  const botPct = cfCurrent.totals.pageViews > 0
    ? ((botPV / cfCurrent.totals.pageViews) * 100).toFixed(0)
    : 0;

  // GA4 summary values
  const ga4Sessions = ga4 ? Math.round(ga4.summary.current.sessions || 0) : null;
  const ga4Users = ga4 ? Math.round(ga4.summary.current.totalUsers || 0) : null;
  const ga4PV = ga4 ? Math.round(ga4.summary.current.screenPageViews || 0) : null;
  const ga4Bounce = ga4 ? ((ga4.summary.current.bounceRate || 0) * 100).toFixed(1) : null;
  const ga4Duration = ga4 ? ga4.summary.current.averageSessionDuration : null;

  // Previous GA4
  const prevSessions = ga4 ? Math.round(ga4.summary.previous.sessions || 0) : null;
  const prevUsers = ga4 ? Math.round(ga4.summary.previous.totalUsers || 0) : null;
  const prevPV = ga4 ? Math.round(ga4.summary.previous.screenPageViews || 0) : null;

  function statCard(label, value, change, color) {
    const changeHtml = change
      ? `<div style="font-size:11px;color:${GRAY_400};margin-top:2px">${change}</div>`
      : '';
    return `<td style="padding:0 6px"><div style="background:#fff;border-radius:10px;padding:16px 12px;text-align:center;border:1px solid ${GRAY_200};min-width:80px">
      <div style="font-size:28px;font-weight:700;color:${color};line-height:1;font-family:${FONT_DISPLAY}">${value}</div>
      <div style="font-size:11px;color:${GRAY_500};margin-top:6px;text-transform:uppercase;letter-spacing:0.5px">${label}</div>
      ${changeHtml}
    </div></td>`;
  }

  function tableRow(cells, isHeader = false) {
    const bg = isHeader ? GRAY_50 : '#fff';
    const weight = isHeader ? '600' : '400';
    const color = isHeader ? GRAY_700 : GRAY_900;
    const border = `border-bottom:1px solid ${GRAY_100}`;
    return '<tr>' + cells.map(c =>
      `<td style="padding:8px 12px;${border};font-size:13px;font-weight:${weight};color:${color};background:${bg}">${c}</td>`
    ).join('') + '</tr>';
  }

  // --- GA4 Human Traffic Table ---
  let ga4Table = '';
  if (ga4) {
    ga4Table = `
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid ${GRAY_200}">
      ${tableRow(['Metric', 'This Week', 'Prev Week', 'Change'], true)}
      ${tableRow(['Sessions', fmtNum(ga4Sessions), fmtNum(prevSessions), pctChange(ga4Sessions, prevSessions)])}
      ${tableRow(['Users', fmtNum(ga4Users), fmtNum(prevUsers), pctChange(ga4Users, prevUsers)])}
      ${tableRow(['Page Views', fmtNum(ga4PV), fmtNum(prevPV), pctChange(ga4PV, prevPV)])}
      ${tableRow(['Avg Duration', fmtDuration(ga4Duration), fmtDuration(ga4?.summary.previous.averageSessionDuration), ''])}
      ${tableRow(['Bounce Rate', ga4Bounce + '%', ((ga4?.summary.previous.bounceRate || 0) * 100).toFixed(1) + '%', ''])}
    </table>
    <div style="font-size:11px;color:${GRAY_400};margin-top:6px;padding:0 4px">GA4 tracks only real browser sessions with consent — source of truth for human traffic.</div>`;
  } else {
    ga4Table = `<div style="padding:16px;background:#fff;border-radius:8px;border:1px solid ${GRAY_200};color:${GRAY_500};font-size:13px;text-align:center">GA4 API not available.</div>`;
  }

  // --- Top Pages ---
  let topPagesHtml = '';
  if (ga4?.topPages?.length) {
    const rows = ga4.topPages.map(p =>
      tableRow([p.path, fmtNum(p.pageViews), fmtNum(p.users), fmtDuration(p.avgDuration)])
    ).join('');
    topPagesHtml = `
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid ${GRAY_200}">
      ${tableRow(['Page', 'Views', 'Users', 'Avg Time'], true)}
      ${rows}
    </table>`;
  }

  // --- Traffic Sources ---
  let sourcesHtml = '';
  if (ga4?.sources?.length) {
    const totalSessions = ga4.sources.reduce((s, x) => s + x.sessions, 0);
    const rows = ga4.sources.map(s =>
      tableRow([s.channel, fmtNum(s.sessions), fmtNum(s.users), ((s.sessions / totalSessions) * 100).toFixed(1) + '%'])
    ).join('');
    sourcesHtml = `
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid ${GRAY_200}">
      ${tableRow(['Channel', 'Sessions', 'Users', '% Total'], true)}
      ${rows}
    </table>`;
  }

  // --- GSC ---
  let gscHtml = '';
  if (gsc?.queries?.length) {
    const totalsLine = gsc.totals
      ? `<div style="padding:12px 16px;background:#fff;border-radius:8px;border:1px solid ${GRAY_200};margin-bottom:12px;font-size:13px;color:${GRAY_700}"><strong>${fmtNum(gsc.totals.clicks)}</strong> clicks &middot; <strong>${fmtNum(gsc.totals.impressions)}</strong> impressions &middot; <strong>${(gsc.totals.ctr * 100).toFixed(1)}%</strong> CTR &middot; avg position <strong>${gsc.totals.position.toFixed(1)}</strong></div>`
      : '';
    const queryRows = gsc.queries.slice(0, 10).map(q =>
      tableRow([q.query, String(q.clicks), fmtNum(q.impressions), (q.ctr * 100).toFixed(1) + '%', q.position.toFixed(1)])
    ).join('');
    gscHtml = `${totalsLine}
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid ${GRAY_200}">
      ${tableRow(['Query', 'Clicks', 'Impressions', 'CTR', 'Pos'], true)}
      ${queryRows}
    </table>`;
    if (gsc.contentGaps?.length) {
      const gapRows = gsc.contentGaps.map(q =>
        tableRow([q.query, fmtNum(q.impressions), (q.ctr * 100).toFixed(1) + '%', q.position.toFixed(1)])
      ).join('');
      gscHtml += `
      <div style="font-size:13px;font-weight:600;color:${NAVY_LIGHT};margin:16px 0 8px">Content Gaps <span style="font-weight:400;color:${GRAY_500}">(high impressions, low CTR)</span></div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid ${GRAY_200}">
        ${tableRow(['Query', 'Impressions', 'CTR', 'Position'], true)}
        ${gapRows}
      </table>`;
    }
  } else {
    gscHtml = `<div style="padding:16px;background:#fff;border-radius:8px;border:1px solid ${GRAY_200};color:${GRAY_500};font-size:13px;text-align:center">No search data yet. Sitemaps submitted — data typically appears 2-3 days after verification.</div>`;
  }

  // --- Cloudflare Table ---
  const c = cfCurrent.totals;
  const p = cfPrevious?.totals || {};
  const cfTable = `
  <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid ${GRAY_200}">
    ${tableRow(['Metric', 'This Week', 'Prev Week', 'Change'], true)}
    ${tableRow(['Page Views', fmtNum(c.pageViews), fmtNum(p.pageViews), pctChange(c.pageViews, p.pageViews)])}
    ${tableRow(['Unique Visitors', fmtNum(c.uniques), fmtNum(p.uniques), pctChange(c.uniques, p.uniques)])}
    ${tableRow(['Total Requests', fmtNum(c.requests), fmtNum(p.requests), pctChange(c.requests, p.requests)])}
    ${tableRow(['Bandwidth', (c.bytes / 1024 / 1024).toFixed(1) + ' MB', p.bytes ? (p.bytes / 1024 / 1024).toFixed(1) + ' MB' : '—', pctChange(c.bytes, p.bytes)])}
  </table>
  <div style="font-size:11px;color:${GRAY_400};margin-top:6px;padding:0 4px">Cloudflare counts all HTTP requests incl. bots. Est. bot page views: ${fmtNum(botPV)} (${botPct}%).${ga4PV != null ? ` GA4 human page views: ${fmtNum(ga4PV)}.` : ''}</div>`;

  // --- Top Countries ---
  const countrySorted = Object.entries(cfCurrent.countries).sort((a, b) => b[1] - a[1]).slice(0, 10);
  let countryHtml = '';
  if (countrySorted.length) {
    const rows = countrySorted.map(([country, reqs]) =>
      tableRow([country, fmtNum(reqs), ((reqs / c.requests) * 100).toFixed(1) + '%'])
    ).join('');
    countryHtml = `
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid ${GRAY_200}">
      ${tableRow(['Country', 'Requests', '% Total'], true)}
      ${rows}
    </table>`;
  }

  // --- Recommendations ---
  const recs = [];
  if (!gsc || !gsc.queries.length) recs.push('Monitor GSC indexing — sitemaps submitted, data should appear soon.');
  if (gsc?.contentGaps?.length) recs.push(`Optimize titles/meta for ${gsc.contentGaps.length} content gaps with high impressions but low CTR.`);
  if (ga4 && (ga4.summary.current.bounceRate || 0) > 0.7) recs.push(`Reduce bounce rate (currently ${((ga4.summary.current.bounceRate) * 100).toFixed(0)}%) — check top landing pages.`);
  if (parseInt(botPct) > 60) recs.push(`Bot traffic is ${botPct}% of Cloudflare views — consider filtering rules if impacting performance.`);
  if (ga4?.sources?.length) {
    const organic = ga4.sources.find(s => s.channel === 'Organic Search');
    if (!organic || organic.sessions < 5) recs.push('Organic search traffic is minimal — focus on backlinks and indexed content.');
  }
  if (!recs.length) recs.push('All systems nominal — continue publishing and monitoring.');

  const recsHtml = recs.map((r, i) => `
    <tr><td style="padding:8px 12px;border-bottom:1px solid ${GRAY_100};font-size:13px;color:${GRAY_900}">
      <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:${RED};color:#fff;border-radius:50%;font-size:11px;font-weight:700;margin-right:8px;vertical-align:middle">${i + 1}</span>
      ${r}
    </td></tr>
  `).join('');

  function sectionTitle(text) {
    return `<div style="font-size:15px;font-weight:700;color:${NAVY_LIGHT};margin:24px 0 10px;font-family:${FONT_DISPLAY}">${text}</div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${GRAY_50};font-family:${FONT}">
<table role="presentation" width="100%" style="background:${GRAY_50};padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" style="max-width:600px;width:100%">

  <!-- Header -->
  <tr><td style="padding:0 0 24px">
    <table role="presentation" width="100%" style="background:${NAVY};border-radius:14px;overflow:hidden">
      <tr><td style="padding:32px 28px">
        <div style="font-size:11px;color:${GRAY_400};text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Superdots</div>
        <div style="font-size:24px;font-weight:700;color:#fff;font-family:${FONT_DISPLAY};margin-bottom:4px">Weekly Traffic Report</div>
        <div style="font-size:13px;color:${GRAY_400}">${week.start} &rarr; ${week.end}</div>
        <div style="width:40px;height:3px;background:${RED};border-radius:2px;margin-top:14px"></div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Hero Stats -->
  <tr><td style="padding:0 0 24px">
    <table role="presentation" width="100%" style="border-collapse:separate;border-spacing:6px 0">
      <tr>
        ${statCard('Sessions', ga4Sessions != null ? fmtNum(ga4Sessions) : '—', ga4Sessions != null ? pctChange(ga4Sessions, prevSessions) : null, RED)}
        ${statCard('Users', ga4Users != null ? fmtNum(ga4Users) : '—', ga4Users != null ? pctChange(ga4Users, prevUsers) : null, TEAL)}
        ${statCard('Page Views', ga4PV != null ? fmtNum(ga4PV) : '—', ga4PV != null ? pctChange(ga4PV, prevPV) : null, '#3b82f6')}
        ${statCard('Bounce', ga4Bounce != null ? ga4Bounce + '%' : '—', null, NAVY_LIGHT)}
      </tr>
    </table>
  </td></tr>

  <!-- GA4 Human Traffic -->
  <tr><td>
    ${sectionTitle('GA4 — Human Traffic')}
    ${ga4Table}
  </td></tr>

  ${topPagesHtml ? `<tr><td>${sectionTitle('Top Pages (GA4)')}${topPagesHtml}</td></tr>` : ''}
  ${sourcesHtml ? `<tr><td>${sectionTitle('Traffic Sources (GA4)')}${sourcesHtml}</td></tr>` : ''}

  <!-- Search Console -->
  <tr><td>
    ${sectionTitle('Search Console')}
    ${gscHtml}
  </td></tr>

  <!-- Cloudflare -->
  <tr><td>
    ${sectionTitle('Cloudflare — All Traffic (incl. bots)')}
    ${cfTable}
  </td></tr>

  ${countryHtml ? `<tr><td>${sectionTitle('Top Countries')}${countryHtml}</td></tr>` : ''}

  <!-- Recommendations -->
  <tr><td>
    ${sectionTitle('Actionable Recommendations')}
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid ${GRAY_200}">
      ${recsHtml}
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:32px 0 0">
    <div style="text-align:center;padding-top:20px;border-top:1px solid ${GRAY_200}">
      <div style="font-size:11px;color:${GRAY_400};margin-bottom:4px">
        Generated ${new Date().toISOString().slice(0, 16)} UTC
      </div>
      <div style="font-size:11px;color:${GRAY_400}">
        <a href="${SITE_URL}" style="color:${RED};text-decoration:none;font-weight:600">superdots.sh</a> &middot; Weekly Traffic Report
      </div>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

async function sendReportEmail(cfCurrent, cfPrevious, ga4, gsc, week) {
  if (!SMTP_PASS) {
    console.error('Missing GMAIL_APP_PASSWORD — cannot send email');
    return false;
  }
  const nodemailer = (await import('nodemailer')).default;
  const transporter = createSmtpTransport(nodemailer);

  const ga4PV = ga4 ? Math.round(ga4.summary.current.screenPageViews || 0) : null;
  const ga4Users = ga4 ? Math.round(ga4.summary.current.totalUsers || 0) : null;
  const subject = `Superdots Traffic Report — ${ga4Users != null ? ga4Users + ' users, ' : ''}${ga4PV != null ? ga4PV + ' page views' : fmtNum(cfCurrent.totals.pageViews) + ' CF views'} (${week.start} → ${week.end})`;

  const html = buildHtmlEmail(cfCurrent, cfPrevious, ga4, gsc, week);

  const info = await transporter.sendMail({
    from: `"Superdots" <${SMTP_USER}>`,
    to: TO_EMAIL,
    subject,
    text: `Superdots Weekly Traffic Report (${week.start} → ${week.end})\n\nView the full report at ${SITE_URL}\n\nGA4: ${ga4PV != null ? ga4PV + ' page views, ' + ga4Users + ' users' : 'unavailable'}\nCloudflare: ${fmtNum(cfCurrent.totals.pageViews)} page views, ${fmtNum(cfCurrent.totals.uniques)} unique visitors`,
    html,
  });

  console.log(`Email sent: ${info.messageId}`);
  return true;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const shouldPost = args.includes('--post');
  const shouldEmail = args.includes('--email');

  const week = weekRange();
  const prevWeek = prevWeekRange();

  console.log(`Report period: ${week.start} to ${week.end}`);
  console.log(`Comparison: ${prevWeek.start} to ${prevWeek.end}`);

  // Fetch all data sources in parallel
  const [currentDays, previousDays, ga4, gsc] = await Promise.all([
    fetchTrafficData(week.start, week.end),
    fetchTrafficData(prevWeek.start, prevWeek.end).catch(() => []),
    fetchGA4Data(week.start, week.end, prevWeek.start, prevWeek.end).catch(e => {
      console.error('GA4 failed:', e.message);
      return null;
    }),
    fetchGSCData(week.start, week.end).catch(e => {
      console.error('GSC failed:', e.message);
      return null;
    }),
  ]);

  const cfCurrent = aggregateDays(currentDays);
  const cfPrevious = previousDays.length ? aggregateDays(previousDays) : null;

  console.log(`Cloudflare: ${currentDays.length} days current, ${previousDays.length} days previous`);
  console.log(`GA4: ${ga4 ? 'connected' : 'unavailable'}`);
  console.log(`GSC: ${gsc ? 'connected' : 'unavailable'} — ${gsc?.queries?.length || 0} queries`);

  const report = buildReport(cfCurrent, cfPrevious, ga4, gsc, week);

  // Save to disk
  mkdirSync(DATA_DIR, { recursive: true });
  const outFile = resolve(DATA_DIR, `report-${fmtDate(new Date())}.md`);
  writeFileSync(outFile, report);
  console.log('Report written to', outFile);

  if (shouldPost) {
    const apiKey = getPaperclipApiKey();
    if (!apiKey) {
      console.error('No PAPERCLIP_API_KEY available — cannot post comment');
      process.exit(1);
    }
    const res = await fetch(`${PAPERCLIP_API_URL}/api/issues/${SUP_197_ID}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: report }),
    });
    if (res.ok) {
      console.log('Report posted to SUP-197');
    } else {
      console.error('Failed to post:', res.status, await res.text());
    }
  }

  if (shouldEmail) {
    await sendReportEmail(cfCurrent, cfPrevious, ga4, gsc, week);
  }

  console.log('\n' + report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
