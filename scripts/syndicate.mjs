#!/usr/bin/env node
/**
 * Content Syndication Pipeline
 *
 * Converts Superdots blog articles into platform-specific formats for:
 * - Dev.to (markdown + frontmatter, via API)
 * - Hashnode (markdown + frontmatter, via GraphQL API)
 *
 * Usage:
 *   node scripts/syndicate.mjs list                     # List articles eligible for syndication
 *   node scripts/syndicate.mjs convert <slug> <platform> # Convert article for a platform
 *   node scripts/syndicate.mjs publish <slug> <platform> # Publish to platform via API
 *   node scripts/syndicate.mjs status                    # Show syndication status
 *
 * Env vars for publishing:
 *   DEVTO_API_KEY     — Dev.to API key
 *   HASHNODE_TOKEN    — Hashnode personal access token
 *   HASHNODE_PUB_ID   — Hashnode publication ID
 *
 * Rules:
 *   - canonical_url always points back to superdots.sh
 *   - UTM parameters on all back-links
 *   - 48h delay after original publish before syndicating
 *   - All articles → Dev.to + Hashnode (Medium API deprecated)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { SITE_URL, BLOG_ROOT, DEVTO_ORG_ID } from './config.mjs';

const BLOG_DIR = resolve(BLOG_ROOT, 'src', 'content', 'blog');
const TRACKER_PATH = resolve(BLOG_ROOT, 'syndication-tracker.json');
const SYNDICATION_DELAY_MS = 48 * 60 * 60 * 1000; // 48 hours

// Platform targeting by department (Medium API deprecated — all go to Dev.to + Hashnode)
const PLATFORM_TARGETING = {
	'engineering': ['devto', 'hashnode'],
	'design': ['devto', 'hashnode'],
	'operations': ['devto', 'hashnode'],
	'finance': ['devto', 'hashnode'],
	'sales': ['devto', 'hashnode'],
	'marketing': ['devto', 'hashnode'],
	'hr': ['devto', 'hashnode'],
	'legal': ['devto', 'hashnode'],
	'customer-support': ['devto', 'hashnode'],
};

// ── Frontmatter parsing ──

function parseFrontmatter(content) {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
	if (!match) throw new Error('No frontmatter found');
	const fm = {};
	for (const line of match[1].split('\n')) {
		const kv = line.match(/^(\w+):\s*['"]?(.*?)['"]?\s*$/);
		if (kv) fm[kv[1]] = kv[2];
		// Handle array fields (tags)
		const arrMatch = line.match(/^(\w+):\s*\[(.*)\]\s*$/);
		if (arrMatch) {
			fm[arrMatch[1]] = arrMatch[2]
				.split(',')
				.map(t => t.trim().replace(/^['"]|['"]$/g, ''));
		}
	}
	// Parse FAQs block separately (multiline)
	const faqMatch = match[1].match(/faqs:\s*\n((?:\s+-[\s\S]*?)*)$/m);
	if (faqMatch) fm._hasFaqs = true;
	return { frontmatter: fm, body: match[2] };
}

function loadArticle(slug) {
	const filePath = resolve(BLOG_DIR, `${slug}.md`);
	if (!existsSync(filePath)) throw new Error(`Article not found: ${slug}`);
	const raw = readFileSync(filePath, 'utf-8');
	return { ...parseFrontmatter(raw), slug, filePath };
}

function listArticles() {
	return readdirSync(BLOG_DIR)
		.filter(f => f.endsWith('.md'))
		.map(f => f.replace(/\.md$/, ''))
		.map(slug => {
			try {
				return loadArticle(slug);
			} catch { return null; }
		})
		.filter(Boolean);
}

// ── Tracker ──

function loadTracker() {
	if (!existsSync(TRACKER_PATH)) return {};
	return JSON.parse(readFileSync(TRACKER_PATH, 'utf-8'));
}

function saveTracker(tracker) {
	writeFileSync(TRACKER_PATH, JSON.stringify(tracker, null, 2) + '\n');
}

function markSyndicated(slug, platform, url) {
	const tracker = loadTracker();
	if (!tracker[slug]) tracker[slug] = {};
	tracker[slug][platform] = {
		syndicatedAt: new Date().toISOString(),
		url,
	};
	saveTracker(tracker);
}

// ── Content transforms ──

function addUtmToLinks(body, platform) {
	// Replace superdots.sh links with UTM-tagged versions
	return body.replace(
		/https:\/\/superdots\.sh(\/[^\s)"\]]*)/g,
		(match, path) => {
			const sep = path.includes('?') ? '&' : '?';
			return `${match}${sep}utm_source=${platform}&utm_medium=syndication`;
		}
	);
}

function stripHeroImage(body) {
	// Remove leading image if present (platforms have their own cover image handling)
	return body.replace(/^\s*!\[.*?\]\(.*?\)\s*\n*/, '');
}

function stripFaqSection(body) {
	// FAQ structured data is Superdots-specific; remove it for syndication
	return body.replace(/## (?:FAQ|Frequently Asked Questions)[\s\S]*$/, '').trim();
}

function cleanBodyForSyndication(body, platform) {
	let cleaned = body;
	cleaned = addUtmToLinks(cleaned, platform);
	cleaned = stripHeroImage(cleaned);
	// Convert relative image paths to absolute
	cleaned = cleaned.replace(
		/!\[(.*?)\]\(\/(images\/.*?)\)/g,
		`![$1](${SITE_URL}/$2)`
	);
	return cleaned;
}

// ── Platform converters ──

function convertForDevto(article) {
	const { frontmatter: fm, body, slug } = article;
	const canonicalUrl = `${SITE_URL}/blog/${slug}/`;
	const tags = (fm.tags || [])
		.slice(0, 4) // Dev.to max 4 tags
		.map(t => t.replace(/^ai-/, '').replace(/-/g, ''));

	const cleaned = cleanBodyForSyndication(body, 'devto');

	const devtoFm = [
		'---',
		`title: "${fm.title}"`,
		`published: true`,
		`description: "${fm.description || ''}"`,
		`tags: ${tags.join(', ')}`,
		`canonical_url: ${canonicalUrl}`,
		`cover_image: ${SITE_URL}${fm.heroImage || ''}`,
		'---',
	].join('\n');

	return `${devtoFm}\n\n${cleaned}\n\n---\n\n*Originally published on [Superdots](${canonicalUrl}?utm_source=devto&utm_medium=syndication).*\n`;
}

function convertForHashnode(article) {
	const { frontmatter: fm, body, slug } = article;
	const canonicalUrl = `${SITE_URL}/blog/${slug}/`;
	const tags = (fm.tags || [])
		.slice(0, 5)
		.map(t => ({ name: t.replace(/^ai-/, ''), slug: t }));

	const cleaned = cleanBodyForSyndication(body, 'hashnode');

	// Hashnode uses a different frontmatter format
	const hashnodeFm = [
		'---',
		`title: "${fm.title}"`,
		`subtitle: "${fm.description || ''}"`,
		`slug: "${slug}"`,
		`canonical: "${canonicalUrl}"`,
		`coverImage: "${SITE_URL}${fm.heroImage || ''}"`,
		`tags: ${JSON.stringify(tags)}`,
		'---',
	].join('\n');

	return `${hashnodeFm}\n\n${cleaned}\n\n---\n\n*Originally published on [Superdots](${canonicalUrl}?utm_source=hashnode&utm_medium=syndication).*\n`;
}

const CONVERTERS = {
	devto: convertForDevto,
	hashnode: convertForHashnode,
};

// ── API publishers ──

async function publishToDevto(article) {
	const apiKey = process.env.DEVTO_API_KEY;
	if (!apiKey) throw new Error('DEVTO_API_KEY not set');

	const { frontmatter: fm, body, slug } = article;
	const canonicalUrl = `${SITE_URL}/blog/${slug}/`;
	const tags = (fm.tags || []).slice(0, 4).map(t => t.replace(/^ai-/, '').replace(/-/g, ''));
	const cleaned = cleanBodyForSyndication(body, 'devto');

	const res = await fetch('https://dev.to/api/articles', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'api-key': apiKey,
		},
		body: JSON.stringify({
			article: {
				title: fm.title,
				body_markdown: cleaned + `\n\n---\n\n*Originally published on [Superdots](${canonicalUrl}?utm_source=devto&utm_medium=syndication).*`,
				published: true,
				canonical_url: canonicalUrl,
				tags,
				description: fm.description || '',
				organization_id: DEVTO_ORG_ID ? Number(DEVTO_ORG_ID) : undefined,
			},
		}),
	});

	if (!res.ok) throw new Error(`Dev.to API error: ${res.status} ${await res.text()}`);
	const data = await res.json();
	markSyndicated(slug, 'devto', data.url);
	return data;
}

async function publishToHashnode(article) {
	const token = process.env.HASHNODE_TOKEN;
	const pubId = process.env.HASHNODE_PUB_ID;
	if (!token) throw new Error('HASHNODE_TOKEN not set');
	if (!pubId) throw new Error('HASHNODE_PUB_ID not set');

	const { frontmatter: fm, body, slug } = article;
	const canonicalUrl = `${SITE_URL}/blog/${slug}/`;
	const tags = (fm.tags || []).slice(0, 5).map(t => ({ name: t.replace(/^ai-/, ''), slug: t }));
	const cleaned = cleanBodyForSyndication(body, 'hashnode');

	const mutation = `
		mutation PublishPost($input: PublishPostInput!) {
			publishPost(input: $input) {
				post { id url slug }
			}
		}
	`;

	const res = await fetch('https://gql.hashnode.com', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': token,
		},
		body: JSON.stringify({
			query: mutation,
			variables: {
				input: {
					title: fm.title,
					subtitle: fm.description || '',
					publicationId: pubId,
					contentMarkdown: cleaned + `\n\n---\n\n*Originally published on [Superdots](${canonicalUrl}?utm_source=hashnode&utm_medium=syndication).*`,
					slug,
					originalArticleURL: canonicalUrl,
					tags,
					coverImageOptions: {
						coverImageURL: `${SITE_URL}${fm.heroImage || ''}`,
					},
				},
			},
		}),
	});

	if (!res.ok) throw new Error(`Hashnode API error: ${res.status} ${await res.text()}`);
	const data = await res.json();
	if (data.errors) throw new Error(`Hashnode GraphQL error: ${JSON.stringify(data.errors)}`);
	const post = data.data.publishPost.post;
	markSyndicated(slug, 'hashnode', post.url);
	return post;
}

const PUBLISHERS = {
	devto: publishToDevto,
	hashnode: publishToHashnode,
};

// ── CLI ──

const [command, ...args] = process.argv.slice(2);

function printUsage() {
	console.log(`Usage:
  node scripts/syndicate.mjs list                       List eligible articles
  node scripts/syndicate.mjs convert <slug> <platform>  Convert article for platform
  node scripts/syndicate.mjs publish <slug> <platform>  Publish to platform via API
  node scripts/syndicate.mjs status                     Show syndication status
  node scripts/syndicate.mjs batch <platform>           Publish all eligible articles to platform

Platforms: devto, hashnode`);
}

function isEligibleForSyndication(article) {
	const pubDate = new Date(article.frontmatter.pubDate);
	const now = new Date();
	return now - pubDate >= SYNDICATION_DELAY_MS;
}

function getTargetPlatforms(article) {
	const dept = article.frontmatter.department || 'operations';
	return PLATFORM_TARGETING[dept] || ['devto', 'hashnode'];
}

switch (command) {
	case 'list': {
		const articles = listArticles();
		const tracker = loadTracker();
		console.log(`\n📋 Articles eligible for syndication (${articles.length} total)\n`);
		console.log('Slug'.padEnd(45) + 'Department'.padEnd(18) + 'Platforms'.padEnd(25) + 'Syndicated');
		console.log('-'.repeat(110));
		for (const a of articles) {
			const eligible = isEligibleForSyndication(a);
			const platforms = getTargetPlatforms(a);
			const synced = tracker[a.slug] || {};
			const syncStatus = platforms.map(p => synced[p] ? `✓${p}` : `○${p}`).join(' ');
			const flag = eligible ? '' : ' [<48h]';
			console.log(
				a.slug.padEnd(45) +
				(a.frontmatter.department || '-').padEnd(18) +
				platforms.join(', ').padEnd(25) +
				syncStatus + flag
			);
		}
		break;
	}

	case 'convert': {
		const [slug, platform] = args;
		if (!slug || !platform) { printUsage(); process.exit(1); }
		if (!CONVERTERS[platform]) { console.error(`Unknown platform: ${platform}`); process.exit(1); }
		const article = loadArticle(slug);
		const output = CONVERTERS[platform](article);
		const outPath = resolve(import.meta.dirname, '..', `syndication-output-${slug}-${platform}.md`);
		writeFileSync(outPath, output);
		console.log(`Converted ${slug} for ${platform} → ${outPath}`);
		break;
	}

	case 'publish': {
		const [slug, platform] = args;
		if (!slug || !platform) { printUsage(); process.exit(1); }
		if (!PUBLISHERS[platform]) { console.error(`Unknown platform: ${platform}`); process.exit(1); }
		const article = loadArticle(slug);
		if (!isEligibleForSyndication(article)) {
			console.error(`Article ${slug} was published less than 48h ago. Wait before syndicating.`);
			process.exit(1);
		}
		const tracker = loadTracker();
		if (tracker[slug]?.[platform]) {
			console.error(`Article ${slug} already syndicated to ${platform} on ${tracker[slug][platform].syndicatedAt}`);
			process.exit(1);
		}
		try {
			const result = await PUBLISHERS[platform](article);
			console.log(`✓ Published ${slug} to ${platform}: ${result.url || JSON.stringify(result)}`);
		} catch (err) {
			console.error(`✗ Failed to publish ${slug} to ${platform}: ${err.message}`);
			process.exit(1);
		}
		break;
	}

	case 'batch': {
		const [platform] = args;
		if (!platform || !PUBLISHERS[platform]) { printUsage(); process.exit(1); }
		const articles = listArticles();
		const tracker = loadTracker();
		const eligible = articles.filter(a =>
			isEligibleForSyndication(a) &&
			getTargetPlatforms(a).includes(platform) &&
			!tracker[a.slug]?.[platform]
		);
		console.log(`\nBatch publishing ${eligible.length} articles to ${platform}...\n`);
		for (const a of eligible) {
			try {
				const result = await PUBLISHERS[platform](a);
				console.log(`  ✓ ${a.slug}: ${result.url || 'OK'}`);
			} catch (err) {
				console.error(`  ✗ ${a.slug}: ${err.message}`);
			}
			// Rate limit: wait 35s between posts (Dev.to enforces 30s windows)
			await new Promise(r => setTimeout(r, 35000));
		}
		break;
	}

	case 'status': {
		const tracker = loadTracker();
		const slugs = Object.keys(tracker);
		if (slugs.length === 0) {
			console.log('No articles syndicated yet.');
			break;
		}
		console.log(`\n📊 Syndication status (${slugs.length} articles)\n`);
		for (const slug of slugs) {
			const platforms = tracker[slug];
			const entries = Object.entries(platforms)
				.map(([p, info]) => `${p}: ${info.syndicatedAt.split('T')[0]} → ${info.url}`)
				.join('\n    ');
			console.log(`  ${slug}\n    ${entries}`);
		}
		break;
	}

	default:
		printUsage();
}
