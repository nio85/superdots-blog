#!/usr/bin/env node
/**
 * Daily Technical SEO Check
 *
 * Automated checks against the live site and local content files.
 *
 * Usage:
 *   node scripts/daily-seo-check.mjs [--json] [--verbose]
 *
 * Flags:
 *   --json     Output raw JSON report to stdout (suppresses markdown)
 *   --verbose  Show per-page details in markdown output
 *
 * Checks performed:
 *   1. Sitemap validity + coverage of all published articles
 *   2. Internal link validation (broken links / 404s)
 *   3. Structured data (JSON-LD) validation on sampled pages
 *   4. Missing meta descriptions, OG tags, canonical URLs
 *   5. Page size / asset size regressions
 *   6. Image optimization (missing alt text, oversized images)
 *   7. robots.txt accessibility
 *   8. RSS feed validity
 *
 * Output: JSON report at /tmp/daily-seo-check.json
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_URL, BLOG_ROOT } from './config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = resolve(BLOG_ROOT, 'src/content/blog');
const REPORT_PATH = '/tmp/daily-seo-check.json';

const args = process.argv.slice(2);
const JSON_OUTPUT = args.includes('--json');
const VERBOSE = args.includes('--verbose');

// Severity levels for findings
const SEV = { critical: 'critical', warning: 'warning', info: 'info' };

// Concurrency limit for fetch requests
const MAX_CONCURRENT = 5;
const FETCH_TIMEOUT_MS = 15_000;

// --- Helpers ---

function log(...a) { if (!JSON_OUTPUT) console.log(...a); }

async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SuperdotsSEOCheck/1.0' },
      redirect: 'follow',
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return { text: await res.text(), status: res.status, headers: res.headers };
}

/** Run tasks with concurrency limit */
async function pooled(tasks, limit = MAX_CONCURRENT) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]().catch(e => ({ error: e.message }));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

/** Extract simple XML tag values (no dependency needed for sitemap parsing) */
function extractXmlTags(xml, tag) {
  const re = new RegExp(`<${tag}>([^<]+)</${tag}>`, 'g');
  const values = [];
  let m;
  while ((m = re.exec(xml))) values.push(m[1].trim());
  return values;
}

/** Get all published article slugs from filesystem */
function getPublishedSlugs() {
  const files = readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
  const slugs = [];
  for (const file of files) {
    const content = readFileSync(resolve(CONTENT_DIR, file), 'utf-8');
    // Skip drafts (draft: true in frontmatter)
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm = fmMatch[1];
    if (/draft:\s*true/i.test(fm)) continue;
    slugs.push(file.replace(/\.(md|mdx)$/, ''));
  }
  return slugs;
}

// --- Check Functions ---

async function checkRobotsTxt() {
  const findings = [];
  const url = `${SITE_URL}/robots.txt`;
  try {
    const { text } = await fetchText(url);
    if (!text.includes('Sitemap:')) {
      findings.push({ severity: SEV.warning, check: 'robots.txt', message: 'robots.txt does not reference a sitemap' });
    }
    if (text.includes('Disallow: /')) {
      const lines = text.split('\n').filter(l => l.startsWith('Disallow:'));
      const blockAll = lines.some(l => l.trim() === 'Disallow: /');
      if (blockAll) {
        findings.push({ severity: SEV.critical, check: 'robots.txt', message: 'robots.txt blocks all crawlers with "Disallow: /"' });
      }
    }
    findings.push({ severity: SEV.info, check: 'robots.txt', message: 'robots.txt is accessible and valid' });
  } catch (e) {
    findings.push({ severity: SEV.critical, check: 'robots.txt', message: `robots.txt unreachable: ${e.message}`, url });
  }
  return findings;
}

async function checkSitemap() {
  const findings = [];
  const indexUrl = `${SITE_URL}/sitemap-index.xml`;

  try {
    const { text: indexXml } = await fetchText(indexUrl);
    const sitemapUrls = extractXmlTags(indexXml, 'loc');

    if (sitemapUrls.length === 0) {
      findings.push({ severity: SEV.critical, check: 'sitemap', message: 'Sitemap index contains no child sitemaps', url: indexUrl });
      return { findings, sitemapPageUrls: [] };
    }

    findings.push({ severity: SEV.info, check: 'sitemap', message: `Sitemap index contains ${sitemapUrls.length} sitemap(s)` });

    // Fetch all child sitemaps
    const allPageUrls = [];
    for (const smUrl of sitemapUrls) {
      try {
        const { text: smXml } = await fetchText(smUrl);
        const locs = extractXmlTags(smXml, 'loc');
        allPageUrls.push(...locs);
      } catch (e) {
        findings.push({ severity: SEV.critical, check: 'sitemap', message: `Child sitemap unreachable: ${e.message}`, url: smUrl });
      }
    }

    // Check that all published articles appear in the sitemap
    const publishedSlugs = getPublishedSlugs();
    const sitemapPaths = new Set(allPageUrls.map(u => {
      try { return new URL(u).pathname.replace(/\/$/, ''); } catch { return u; }
    }));

    const missingSlugs = publishedSlugs.filter(slug => !sitemapPaths.has(`/blog/${slug}`));
    if (missingSlugs.length > 0) {
      findings.push({
        severity: SEV.warning,
        check: 'sitemap',
        message: `${missingSlugs.length} published article(s) missing from sitemap`,
        details: missingSlugs.slice(0, 10),
      });
    } else {
      findings.push({ severity: SEV.info, check: 'sitemap', message: `All ${publishedSlugs.length} published articles found in sitemap` });
    }

    findings.push({ severity: SEV.info, check: 'sitemap', message: `Sitemap contains ${allPageUrls.length} total URLs` });

    return { findings, sitemapPageUrls: allPageUrls };
  } catch (e) {
    findings.push({ severity: SEV.critical, check: 'sitemap', message: `Sitemap index unreachable: ${e.message}`, url: indexUrl });
    return { findings, sitemapPageUrls: [] };
  }
}

async function checkRssFeed() {
  const findings = [];
  const url = `${SITE_URL}/rss.xml`;
  try {
    const { text, headers } = await fetchText(url);
    const contentType = headers.get('content-type') || '';

    if (!text.includes('<rss') && !text.includes('<feed')) {
      findings.push({ severity: SEV.critical, check: 'rss', message: 'RSS feed does not contain valid RSS/Atom markup', url });
    } else {
      const items = extractXmlTags(text, 'title');
      // First title is the feed title, rest are items
      const itemCount = Math.max(0, items.length - 1);
      findings.push({ severity: SEV.info, check: 'rss', message: `RSS feed valid with ${itemCount} item(s)` });

      if (itemCount === 0) {
        findings.push({ severity: SEV.warning, check: 'rss', message: 'RSS feed contains 0 items' });
      }

      // Check for required RSS elements
      if (!text.includes('<link>') && !text.includes('<link ')) {
        findings.push({ severity: SEV.warning, check: 'rss', message: 'RSS feed missing <link> element' });
      }
      if (!text.includes('<description>')) {
        findings.push({ severity: SEV.warning, check: 'rss', message: 'RSS feed missing <description> element' });
      }
    }
  } catch (e) {
    findings.push({ severity: SEV.critical, check: 'rss', message: `RSS feed unreachable: ${e.message}`, url });
  }
  return findings;
}

/**
 * Check a page for meta tags, OG tags, canonical URL, JSON-LD, images, internal links.
 * Returns findings + discovered internal links.
 */
async function checkPage(url) {
  const findings = [];
  const internalLinks = new Set();

  try {
    const res = await fetchWithTimeout(url);
    const status = res.status;
    const html = await res.text();
    const pageSize = new TextEncoder().encode(html).byteLength;
    const pathname = new URL(url).pathname;

    // Page size check (warn above 500KB)
    if (pageSize > 500_000) {
      findings.push({ severity: SEV.warning, check: 'page-size', message: `Page is ${(pageSize / 1024).toFixed(0)}KB (over 500KB)`, url });
    }

    // Meta description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
      || html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
    if (!descMatch || !descMatch[1].trim()) {
      findings.push({ severity: SEV.warning, check: 'meta', message: 'Missing or empty meta description', url });
    }

    // Canonical URL
    const canonMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
    if (!canonMatch) {
      findings.push({ severity: SEV.warning, check: 'meta', message: 'Missing canonical URL', url });
    }

    // OG tags
    const ogTags = ['og:title', 'og:description', 'og:url'];
    for (const tag of ogTags) {
      const re = new RegExp(`<meta\\s+(?:property|name)=["']${tag}["']\\s+content=["']([^"']*)["']`, 'i');
      const altRe = new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+(?:property|name)=["']${tag}["']`, 'i');
      if (!re.test(html) && !altRe.test(html)) {
        findings.push({ severity: SEV.warning, check: 'og-tags', message: `Missing ${tag}`, url });
      }
    }

    // JSON-LD structured data
    const jsonLdMatches = html.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi);
    if (!jsonLdMatches || jsonLdMatches.length === 0) {
      findings.push({ severity: SEV.warning, check: 'structured-data', message: 'No JSON-LD structured data found', url });
    } else {
      for (const match of jsonLdMatches) {
        const jsonStr = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
        try {
          JSON.parse(jsonStr);
        } catch {
          findings.push({ severity: SEV.critical, check: 'structured-data', message: 'Invalid JSON-LD (parse error)', url });
        }
      }
      // Check for Article schema on blog pages
      if (pathname.startsWith('/blog/') && pathname !== '/blog/') {
        const hasArticle = jsonLdMatches.some(m => m.includes('"Article"') || m.includes('"BlogPosting"'));
        if (!hasArticle) {
          findings.push({ severity: SEV.warning, check: 'structured-data', message: 'Blog post missing Article/BlogPosting schema', url });
        }
      }
    }

    // Images: check for missing alt text and oversized images
    const imgRe = /<img\s[^>]*>/gi;
    let imgMatch;
    let imgCount = 0;
    let missingAlt = 0;
    while ((imgMatch = imgRe.exec(html))) {
      imgCount++;
      const tag = imgMatch[0];
      if (!tag.includes('alt=') || /alt=["']\s*["']/i.test(tag)) {
        missingAlt++;
      }
    }
    if (missingAlt > 0) {
      findings.push({ severity: SEV.warning, check: 'images', message: `${missingAlt} image(s) missing alt text (of ${imgCount} total)`, url });
    }

    // Internal links
    const linkRe = /href=["'](\/[^"']*|https?:\/\/superdots\.sh[^"']*?)["']/gi;
    let linkMatch;
    while ((linkMatch = linkRe.exec(html))) {
      let href = linkMatch[1];
      if (href.startsWith('/')) href = `${SITE_URL}${href}`;
      // Skip anchors, assets, and query strings for link checking
      const parsed = new URL(href);
      if (parsed.hostname === 'superdots.sh' && !parsed.pathname.match(/\.(css|js|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|eot)$/i)) {
        internalLinks.add(parsed.origin + parsed.pathname);
      }
    }

    return { findings, internalLinks: [...internalLinks], pageSize };
  } catch (e) {
    findings.push({ severity: SEV.critical, check: 'page-fetch', message: `Failed to fetch page: ${e.message}`, url });
    return { findings, internalLinks: [], pageSize: 0 };
  }
}

async function checkInternalLinks(urls) {
  const findings = [];
  const checked = new Set();
  const broken = [];

  const tasks = urls.filter(u => {
    if (checked.has(u)) return false;
    checked.add(u);
    return true;
  }).map(url => async () => {
    try {
      const res = await fetchWithTimeout(url);
      if (res.status >= 400) {
        broken.push({ url, status: res.status });
      }
    } catch (e) {
      broken.push({ url, status: 'error', error: e.message });
    }
  });

  await pooled(tasks, MAX_CONCURRENT);

  if (broken.length > 0) {
    findings.push({
      severity: SEV.critical,
      check: 'broken-links',
      message: `${broken.length} broken internal link(s) found`,
      details: broken.slice(0, 20),
    });
  } else {
    findings.push({ severity: SEV.info, check: 'broken-links', message: `All ${checked.size} internal links valid` });
  }

  return findings;
}

async function checkImageSizes(sitemapUrls) {
  const findings = [];
  // Sample a few blog pages and check image sizes via HEAD requests
  const blogUrls = sitemapUrls.filter(u => u.includes('/blog/')).slice(0, 10);
  const oversized = [];

  for (const pageUrl of blogUrls) {
    try {
      const res = await fetchWithTimeout(pageUrl);
      const html = await res.text();
      const srcRe = /src=["'](\/images\/[^"']+|https?:\/\/superdots\.sh\/images\/[^"']+)["']/gi;
      let m;
      while ((m = srcRe.exec(html))) {
        let imgUrl = m[1];
        if (imgUrl.startsWith('/')) imgUrl = `${SITE_URL}${imgUrl}`;
        try {
          const headRes = await fetchWithTimeout(imgUrl);
          const cl = headRes.headers.get('content-length');
          if (cl && parseInt(cl) > 500_000) {
            oversized.push({ url: imgUrl, sizeKB: Math.round(parseInt(cl) / 1024), page: pageUrl });
          }
        } catch {}
      }
    } catch {}
  }

  if (oversized.length > 0) {
    findings.push({
      severity: SEV.warning,
      check: 'image-size',
      message: `${oversized.length} oversized image(s) (>500KB)`,
      details: oversized.slice(0, 10),
    });
  } else {
    findings.push({ severity: SEV.info, check: 'image-size', message: 'No oversized images found in sampled pages' });
  }

  return findings;
}

// --- Main ---

async function main() {
  log('Daily Technical SEO Check — ' + new Date().toISOString().slice(0, 16) + ' UTC');
  log(`Site: ${SITE_URL}\n`);

  const allFindings = [];
  const stats = {};

  // 1. robots.txt
  log('Checking robots.txt...');
  const robotsFindings = await checkRobotsTxt();
  allFindings.push(...robotsFindings);

  // 2. Sitemap
  log('Checking sitemap...');
  const { findings: sitemapFindings, sitemapPageUrls } = await checkSitemap();
  allFindings.push(...sitemapFindings);
  stats.sitemapUrls = sitemapPageUrls.length;
  stats.publishedArticles = getPublishedSlugs().length;

  // 3. RSS feed
  log('Checking RSS feed...');
  const rssFindings = await checkRssFeed();
  allFindings.push(...rssFindings);

  // 4. Sample pages for meta/OG/JSON-LD/images/links
  // Check homepage + blog index + sample of blog posts
  const pagesToCheck = [
    SITE_URL,
    `${SITE_URL}/blog/`,
  ];

  // Sample up to 15 blog pages from sitemap
  const blogPages = sitemapPageUrls.filter(u => u.includes('/blog/') && u !== `${SITE_URL}/blog/`);
  const sampleSize = Math.min(15, blogPages.length);
  const sampled = blogPages.sort(() => Math.random() - 0.5).slice(0, sampleSize);
  pagesToCheck.push(...sampled);

  log(`Checking ${pagesToCheck.length} pages (meta, OG, JSON-LD, images, links)...`);

  const allInternalLinks = new Set();
  const pageSizes = [];

  const pageResults = await pooled(
    pagesToCheck.map(url => () => checkPage(url)),
    MAX_CONCURRENT,
  );

  for (const result of pageResults) {
    if (result.error) {
      allFindings.push({ severity: SEV.critical, check: 'page-fetch', message: result.error });
      continue;
    }
    allFindings.push(...result.findings);
    for (const link of result.internalLinks) allInternalLinks.add(link);
    if (result.pageSize) pageSizes.push(result.pageSize);
  }

  stats.pagesChecked = pagesToCheck.length;
  stats.avgPageSizeKB = pageSizes.length
    ? Math.round(pageSizes.reduce((a, b) => a + b, 0) / pageSizes.length / 1024)
    : 0;

  // 5. Check internal links for 404s
  // Add links from sitemap that weren't already discovered
  for (const u of sitemapPageUrls) allInternalLinks.add(u);

  // Limit to reasonable number
  const linksToCheck = [...allInternalLinks].slice(0, 200);
  log(`Checking ${linksToCheck.length} internal links for 404s...`);
  const linkFindings = await checkInternalLinks(linksToCheck);
  allFindings.push(...linkFindings);
  stats.internalLinksChecked = linksToCheck.length;

  // 6. Check image sizes on sampled blog pages
  log('Checking image sizes...');
  const imgFindings = await checkImageSizes(sitemapPageUrls);
  allFindings.push(...imgFindings);

  // --- Build report ---
  const critical = allFindings.filter(f => f.severity === SEV.critical);
  const warnings = allFindings.filter(f => f.severity === SEV.warning);
  const infos = allFindings.filter(f => f.severity === SEV.info);

  const report = {
    timestamp: new Date().toISOString(),
    site: SITE_URL,
    stats,
    summary: {
      critical: critical.length,
      warnings: warnings.length,
      info: infos.length,
      hasCritical: critical.length > 0,
    },
    findings: allFindings,
  };

  // Save JSON report
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    // Markdown output
    log('\n--- SEO Check Report ---\n');
    log(`Summary: ${critical.length} critical, ${warnings.length} warnings, ${infos.length} info`);
    log(`Stats: ${stats.publishedArticles} articles, ${stats.sitemapUrls} sitemap URLs, ${stats.pagesChecked} pages checked, ${stats.internalLinksChecked} links checked\n`);

    if (critical.length > 0) {
      log('CRITICAL:');
      for (const f of critical) log(`  [${f.check}] ${f.message}${f.url ? ' — ' + f.url : ''}`);
      log('');
    }
    if (warnings.length > 0) {
      log('WARNINGS:');
      for (const f of warnings) log(`  [${f.check}] ${f.message}${f.url ? ' — ' + f.url : ''}`);
      log('');
    }
    if (VERBOSE && infos.length > 0) {
      log('INFO:');
      for (const f of infos) log(`  [${f.check}] ${f.message}`);
      log('');
    }

    log(`Report saved to ${REPORT_PATH}`);
  }

  // Exit with non-zero if critical issues found
  if (critical.length > 0) {
    log(`\nExit 1: ${critical.length} critical issue(s) found`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('SEO check failed:', e);
  process.exit(2);
});
