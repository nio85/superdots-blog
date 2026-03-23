/**
 * External Debug Pipeline for superdots.sh
 *
 * Checks: HTTP uptime, SSL expiry, DNS, sitemap, RSS, broken links,
 *         page performance (TTFB), Cloudflare Pages deploy status.
 *
 * Output: JSON report to /tmp/debug-external-latest.json
 * Exit: 0 = all pass, 1 = any failure
 * On critical failure (site down, SSL <14 days): sends alert email via Resend SMTP.
 */

import { writeFileSync } from 'fs';
import * as tls from 'tls';
import * as dns from 'dns/promises';
import nodemailer from 'nodemailer';
import {
  SITE_URL as SITE, SITE_HOST as HOST,
  CF_ACCOUNT_ID as CF_ACCOUNT, CF_PROJECT_NAME as CF_PROJECT,
  SMTP_USER, SMTP_PASS,
  REPORT_EXTERNAL_PATH as REPORT_PATH,
  createSmtpTransport,
} from './config.mjs';

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

// --- Helpers ---

function ok(name, detail = '') {
  return { name, status: 'pass', detail };
}

function fail(name, detail = '') {
  return { name, status: 'fail', detail };
}

async function timedFetch(url, timeoutMs = 10000) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const latencyMs = Date.now() - start;
    return { res, latencyMs };
  } finally {
    clearTimeout(timer);
  }
}

// --- Checks ---

async function checkHttpUptime() {
  try {
    const { res, latencyMs } = await timedFetch(SITE);
    if (res.status !== 200) return fail('http_uptime', `Status ${res.status}, ${latencyMs}ms`);
    if (latencyMs > 3000) return fail('http_uptime', `Slow: ${latencyMs}ms (>3s threshold)`);
    return ok('http_uptime', `${res.status} in ${latencyMs}ms`);
  } catch (e) {
    return fail('http_uptime', e.message);
  }
}

async function checkSslExpiry() {
  return new Promise((resolve) => {
    const socket = tls.connect(443, HOST, { servername: HOST }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert || !cert.valid_to) {
        resolve(fail('ssl_expiry', 'No certificate returned'));
        return;
      }
      const expiresAt = new Date(cert.valid_to);
      const daysLeft = Math.floor((expiresAt - Date.now()) / 86400000);
      if (daysLeft < 14) {
        resolve(fail('ssl_expiry', `Expires in ${daysLeft} days (${cert.valid_to})`));
      } else {
        resolve(ok('ssl_expiry', `${daysLeft} days remaining (${cert.valid_to})`));
      }
    });
    socket.on('error', (e) => resolve(fail('ssl_expiry', e.message)));
    socket.setTimeout(10000, () => { socket.destroy(); resolve(fail('ssl_expiry', 'Timeout')); });
  });
}

async function checkDns() {
  try {
    const addresses = await dns.resolve4(HOST);
    if (!addresses.length) return fail('dns', 'No A records');
    return ok('dns', `A: ${addresses.join(', ')}`);
  } catch (e) {
    return fail('dns', e.message);
  }
}

async function checkSitemap() {
  try {
    const { res } = await timedFetch(`${SITE}/sitemap-index.xml`);
    if (res.status !== 200) return fail('sitemap', `Status ${res.status}`);
    const body = await res.text();
    const locs = body.match(/<loc>/g);
    if (!locs) return fail('sitemap', 'No <loc> entries found');
    return ok('sitemap', `${locs.length} sitemap entries`);
  } catch (e) {
    return fail('sitemap', e.message);
  }
}

async function checkRss() {
  try {
    const { res } = await timedFetch(`${SITE}/rss.xml`);
    if (res.status !== 200) return fail('rss', `Status ${res.status}`);
    const body = await res.text();
    const items = body.match(/<item>/g);
    return ok('rss', `${items ? items.length : 0} items`);
  } catch (e) {
    return fail('rss', e.message);
  }
}

async function checkBrokenLinks() {
  try {
    const { res: idxRes } = await timedFetch(`${SITE}/sitemap-index.xml`);
    if (idxRes.status !== 200) return fail('broken_links', 'Cannot fetch sitemap index');
    const idxBody = await idxRes.text();
    const sitemapUrls = [...idxBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

    const pageUrls = [];
    for (const smUrl of sitemapUrls) {
      try {
        const { res: smRes } = await timedFetch(smUrl);
        if (smRes.status === 200) {
          const smBody = await smRes.text();
          const urls = [...smBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
          pageUrls.push(...urls);
        }
      } catch {}
    }

    if (!pageUrls.length) return fail('broken_links', 'No pages found in sitemap');

    const broken = [];
    const batchSize = 10;
    for (let i = 0; i < pageUrls.length; i += batchSize) {
      const batch = pageUrls.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (url) => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);
          const r = await fetch(url, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timer);
          if (r.status >= 400) return url;
        } catch {
          return url;
        }
        return null;
      }));
      broken.push(...results.filter(Boolean));
    }

    if (broken.length) return fail('broken_links', `${broken.length}/${pageUrls.length} broken: ${broken.slice(0, 5).join(', ')}`);
    return ok('broken_links', `${pageUrls.length} pages checked, all OK`);
  } catch (e) {
    return fail('broken_links', e.message);
  }
}

async function checkPerformance() {
  try {
    const { latencyMs: homeTtfb } = await timedFetch(SITE);

    const { res: idxRes } = await timedFetch(`${SITE}/sitemap-index.xml`);
    const idxBody = await idxRes.text();
    const sitemapUrls = [...idxBody.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

    const articleUrls = [];
    for (const smUrl of sitemapUrls) {
      try {
        const { res: smRes } = await timedFetch(smUrl);
        if (smRes.status === 200) {
          const smBody = await smRes.text();
          const urls = [...smBody.matchAll(/<loc>([^<]+)<\/loc>/g)]
            .map(m => m[1])
            .filter(u => u !== `${SITE}/` && u.includes('/blog/'));
          articleUrls.push(...urls);
        }
      } catch {}
    }

    const sample = articleUrls.sort(() => Math.random() - 0.5).slice(0, 3);
    const ttfbs = [{ url: SITE, ttfb: homeTtfb }];

    for (const url of sample) {
      try {
        const { latencyMs } = await timedFetch(url);
        ttfbs.push({ url, ttfb: latencyMs });
      } catch (e) {
        ttfbs.push({ url, ttfb: -1, error: e.message });
      }
    }

    const avgTtfb = Math.round(ttfbs.reduce((s, t) => s + (t.ttfb > 0 ? t.ttfb : 0), 0) / ttfbs.filter(t => t.ttfb > 0).length);
    const slow = ttfbs.filter(t => t.ttfb > 3000);
    const detail = `Avg TTFB: ${avgTtfb}ms (${ttfbs.length} pages). ${slow.length ? `Slow: ${slow.map(s => s.url).join(', ')}` : 'All fast.'}`;

    if (slow.length) return fail('performance', detail);
    return ok('performance', detail);
  } catch (e) {
    return fail('performance', e.message);
  }
}

async function checkCloudflareDeploy() {
  if (!CF_TOKEN) return { name: 'cf_deploy', status: 'skip', detail: 'CLOUDFLARE_API_TOKEN not set' };

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/pages/projects/${CF_PROJECT}/deployments?per_page=1`,
      { headers: { Authorization: `Bearer ${CF_TOKEN}` } }
    );
    if (!res.ok) return fail('cf_deploy', `CF API ${res.status}`);
    const data = await res.json();
    const deploy = data.result?.[0];
    if (!deploy) return fail('cf_deploy', 'No deployments found');

    const status = deploy.latest_stage?.status || 'unknown';
    const env = deploy.environment || 'unknown';
    const at = deploy.created_on ? new Date(deploy.created_on).toISOString() : 'unknown';

    if (status === 'success') return ok('cf_deploy', `Latest: ${env} ${status} at ${at}`);
    return fail('cf_deploy', `Latest: ${env} ${status} at ${at}`);
  } catch (e) {
    return fail('cf_deploy', e.message);
  }
}

// --- Alert email ---

async function sendAlert(criticals) {
  if (!SMTP_PASS) {
    console.error('Cannot send alert: RESEND_SMTP_API_KEY not set');
    return;
  }

  const transporter = createSmtpTransport(nodemailer);

  const lines = criticals.map(c => `- **${c.name}**: ${c.detail}`).join('\n');
  const text = `CRITICAL: superdots.sh external checks failed\n\n${lines}\n\nReport: ${REPORT_PATH}`;
  const html = `<h2 style="color:#ef4444">superdots.sh — Critical Alert</h2>
<ul>${criticals.map(c => `<li><strong>${c.name}</strong>: ${c.detail}</li>`).join('')}</ul>
<p style="color:#6b7280;font-size:12px">Report: ${REPORT_PATH}</p>`;

  await transporter.sendMail({
    from: `"Superdots Alert" <${SMTP_USER}>`,
    to: SMTP_USER,
    subject: `[CRITICAL] superdots.sh — ${criticals.map(c => c.name).join(', ')}`,
    text,
    html,
  });

  console.log('Alert email sent.');
}

// --- Main ---

async function main() {
  console.log(`External debug pipeline — ${new Date().toISOString()}`);
  console.log(`Target: ${SITE}\n`);

  const checks = await Promise.all([
    checkHttpUptime(),
    checkSslExpiry(),
    checkDns(),
    checkSitemap(),
    checkRss(),
    checkBrokenLinks(),
    checkPerformance(),
    checkCloudflareDeploy(),
  ]);

  const report = {
    timestamp: new Date().toISOString(),
    site: SITE,
    checks,
    summary: {
      total: checks.length,
      pass: checks.filter(c => c.status === 'pass').length,
      fail: checks.filter(c => c.status === 'fail').length,
      skip: checks.filter(c => c.status === 'skip').length,
    },
  };

  for (const c of checks) {
    const icon = c.status === 'pass' ? 'PASS' : c.status === 'skip' ? 'SKIP' : 'FAIL';
    console.log(`[${icon}] ${c.name}: ${c.detail}`);
  }

  console.log(`\nSummary: ${report.summary.pass}/${report.summary.total} passed`);

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`Report written to ${REPORT_PATH}`);

  const criticals = checks.filter(c =>
    c.status === 'fail' && (c.name === 'http_uptime' || c.name === 'ssl_expiry')
  );
  if (criticals.length) {
    console.log('\nSending critical alert...');
    await sendAlert(criticals);
  }

  const hasFail = checks.some(c => c.status === 'fail');
  process.exit(hasFail ? 1 : 0);
}

main().catch(err => {
  console.error('Pipeline failed:', err.message);
  process.exit(1);
});
