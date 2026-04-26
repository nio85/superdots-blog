import { describe, expect, it } from 'vitest';
import { parseFrontmatterDates, sitemapFilter, sitemapSerialize } from './sitemap';

describe('sitemapFilter', () => {
	const empty = new Set<string>();

	it('allows normal blog URLs', () => {
		expect(sitemapFilter('https://superdots.sh/blog/my-post/', empty)).toBe(true);
	});

	it('excludes /design-system', () => {
		expect(sitemapFilter('https://superdots.sh/design-system/', empty)).toBe(false);
	});

	it('excludes /analytics-optout', () => {
		expect(sitemapFilter('https://superdots.sh/analytics-optout/', empty)).toBe(false);
	});

	it('excludes /tags/ pages', () => {
		expect(sitemapFilter('https://superdots.sh/tags/ai-tools/', empty)).toBe(false);
	});

	it('excludes /category/ pages', () => {
		expect(sitemapFilter('https://superdots.sh/category/marketing/', empty)).toBe(false);
	});

	it('excludes /404', () => {
		expect(sitemapFilter('https://superdots.sh/404/', empty)).toBe(false);
	});

	it('excludes pages in the noindex set', () => {
		const noindex = new Set(['https://superdots.sh/blog/draft-post/']);
		expect(sitemapFilter('https://superdots.sh/blog/draft-post/', noindex)).toBe(false);
	});

	it('allows pages not in the noindex set', () => {
		const noindex = new Set(['https://superdots.sh/blog/other/']);
		expect(sitemapFilter('https://superdots.sh/blog/my-post/', noindex)).toBe(true);
	});

	it('allows the homepage', () => {
		expect(sitemapFilter('https://superdots.sh/', empty)).toBe(true);
	});

	it('allows /guides/', () => {
		expect(sitemapFilter('https://superdots.sh/guides/', empty)).toBe(true);
	});
});

describe('sitemapSerialize', () => {
	const emptyMap = new Map<string, string>();
	const buildDate = '2026-04-26';

	it('sets homepage to weekly/1.0', () => {
		const item = sitemapSerialize({ url: 'https://superdots.sh/' }, emptyMap, buildDate);
		expect(item.changefreq).toBe('weekly');
		expect(item.priority).toBe(1.0);
	});

	it('sets /blog/ index to daily/0.9', () => {
		const item = sitemapSerialize({ url: 'https://superdots.sh/blog/' }, emptyMap, buildDate);
		expect(item.changefreq).toBe('daily');
		expect(item.priority).toBe(0.9);
	});

	it('sets /guides/ to weekly/0.85', () => {
		const item = sitemapSerialize({ url: 'https://superdots.sh/guides/' }, emptyMap, buildDate);
		expect(item.changefreq).toBe('weekly');
		expect(item.priority).toBe(0.85);
	});

	it('sets pillar pages (ai-for-*) to weekly/0.8', () => {
		const item = sitemapSerialize({ url: 'https://superdots.sh/blog/ai-for-hr/' }, emptyMap, buildDate);
		expect(item.changefreq).toBe('weekly');
		expect(item.priority).toBe(0.8);
	});

	it('sets regular blog posts to monthly/0.7', () => {
		const item = sitemapSerialize({ url: 'https://superdots.sh/blog/my-article/' }, emptyMap, buildDate);
		expect(item.changefreq).toBe('monthly');
		expect(item.priority).toBe(0.7);
	});

	it('sets other pages to monthly/0.5', () => {
		const item = sitemapSerialize({ url: 'https://superdots.sh/about/' }, emptyMap, buildDate);
		expect(item.changefreq).toBe('monthly');
		expect(item.priority).toBe(0.5);
	});

	it('uses lastmod from map when available', () => {
		const map = new Map([['https://superdots.sh/blog/my-post/', '2026-04-15']]);
		const item = sitemapSerialize({ url: 'https://superdots.sh/blog/my-post/' }, map, buildDate);
		expect(item.lastmod).toBe('2026-04-15');
	});

	it('falls back to buildDate when no lastmod entry exists', () => {
		const item = sitemapSerialize({ url: 'https://superdots.sh/blog/new-post/' }, emptyMap, buildDate);
		expect(item.lastmod).toBe('2026-04-26');
	});
});

describe('parseFrontmatterDates', () => {
	it('extracts pubDate from frontmatter', () => {
		const raw = `---
title: Test
pubDate: 2026-04-20
---
Content here`;
		const result = parseFrontmatterDates(raw);
		expect(result.pubDate).toBe('2026-04-20');
		expect(result.updatedDate).toBeUndefined();
		expect(result.noindex).toBe(false);
	});

	it('extracts updatedDate from frontmatter', () => {
		const raw = `---
title: Test
pubDate: 2026-04-15
updatedDate: 2026-04-20
---
Content`;
		const result = parseFrontmatterDates(raw);
		expect(result.pubDate).toBe('2026-04-15');
		expect(result.updatedDate).toBe('2026-04-20');
	});

	it('detects noindex: true', () => {
		const raw = `---
title: Draft
pubDate: 2026-04-20
noindex: true
---
Content`;
		expect(parseFrontmatterDates(raw).noindex).toBe(true);
	});

	it('handles quoted dates', () => {
		const raw = `---
pubDate: '2026-04-20'
updatedDate: "2026-04-22"
---
Content`;
		const result = parseFrontmatterDates(raw);
		expect(result.pubDate).toBe('2026-04-20');
		expect(result.updatedDate).toBe('2026-04-22');
	});

	it('returns defaults when no frontmatter found', () => {
		const result = parseFrontmatterDates('No frontmatter here');
		expect(result.pubDate).toBeUndefined();
		expect(result.updatedDate).toBeUndefined();
		expect(result.noindex).toBe(false);
	});

	it('returns defaults for empty frontmatter', () => {
		const raw = `---
title: Empty dates
---
Content`;
		const result = parseFrontmatterDates(raw);
		expect(result.pubDate).toBeUndefined();
		expect(result.updatedDate).toBeUndefined();
	});
});
