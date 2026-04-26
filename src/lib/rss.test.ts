import { describe, expect, it } from 'vitest';
import { buildRssCustomData, buildRssItem, postsToRssItems } from './rss';

const SITE = 'https://superdots.sh';

describe('buildRssItem', () => {
	const base = {
		title: 'Test Post',
		pubDate: new Date('2026-04-20'),
		description: 'A test description',
		slug: 'test-post',
	};

	it('builds link with /blog/ prefix and trailing slash', () => {
		const item = buildRssItem(base, SITE);
		expect(item.link).toBe('/blog/test-post/');
	});

	it('concatenates siteUrl + heroImage for media:content', () => {
		const item = buildRssItem({ ...base, heroImage: '/images/blog/hero.webp' }, SITE);
		expect(item.customData).toContain(
			'<media:content url="https://superdots.sh/images/blog/hero.webp" medium="image" type="image/webp"/>'
		);
	});

	it('omits media:content when heroImage is missing', () => {
		const item = buildRssItem(base, SITE);
		expect(item.customData).not.toContain('media:content');
	});

	it('includes dc:creator when author is set', () => {
		const item = buildRssItem({ ...base, author: 'Superdots Team' }, SITE);
		expect(item.customData).toContain('<dc:creator>Superdots Team</dc:creator>');
	});

	it('omits dc:creator when author is missing', () => {
		const item = buildRssItem(base, SITE);
		expect(item.customData).not.toContain('dc:creator');
	});

	it('includes both dc:creator and media:content joined by newline', () => {
		const item = buildRssItem({ ...base, author: 'Jane', heroImage: '/images/blog/pic.webp' }, SITE);
		expect(item.customData).toBe(
			'<dc:creator>Jane</dc:creator>\n<media:content url="https://superdots.sh/images/blog/pic.webp" medium="image" type="image/webp"/>'
		);
	});

	it('returns empty customData when neither author nor heroImage is set', () => {
		const item = buildRssItem(base, SITE);
		expect(item.customData).toBe('');
	});

	it('preserves title, pubDate, and description verbatim', () => {
		const item = buildRssItem(base, SITE);
		expect(item.title).toBe('Test Post');
		expect(item.pubDate).toEqual(new Date('2026-04-20'));
		expect(item.description).toBe('A test description');
	});

	it('handles heroImage paths that already start with /', () => {
		const item = buildRssItem({ ...base, heroImage: '/images/blog/test.webp' }, SITE);
		expect(item.customData).toContain('url="https://superdots.sh/images/blog/test.webp"');
	});
});

describe('buildRssCustomData', () => {
	it('includes language element', () => {
		const data = buildRssCustomData(SITE, new Date('2026-04-20'));
		expect(data).toContain('<language>en</language>');
	});

	it('includes lastBuildDate in UTC string format', () => {
		const date = new Date('2026-04-20T12:00:00Z');
		const data = buildRssCustomData(SITE, date);
		expect(data).toContain(`<lastBuildDate>${date.toUTCString()}</lastBuildDate>`);
	});

	it('includes atom self-link with /rss.xml', () => {
		const data = buildRssCustomData(SITE, new Date());
		expect(data).toContain('<atom:link href="https://superdots.sh/rss.xml" rel="self" type="application/rss+xml"/>');
	});

	it('strips trailing slash from siteUrl in atom link', () => {
		const data = buildRssCustomData('https://superdots.sh', new Date());
		expect(data).not.toContain('superdots.sh//rss.xml');
	});
});

describe('postsToRssItems', () => {
	it('maps array of posts to RSS items', () => {
		const posts = [
			{
				slug: 'post-one',
				data: {
					title: 'Post One',
					pubDate: new Date('2026-04-20'),
					description: 'First post',
					slug: 'ignored',
					author: 'Alice',
				},
			},
			{
				slug: 'post-two',
				data: {
					title: 'Post Two',
					pubDate: new Date('2026-04-19'),
					description: 'Second post',
					slug: 'ignored',
					heroImage: '/images/blog/two.webp',
				},
			},
		];
		const items = postsToRssItems(posts, SITE);
		expect(items).toHaveLength(2);
		expect(items[0].link).toBe('/blog/post-one/');
		expect(items[0].customData).toContain('Alice');
		expect(items[1].link).toBe('/blog/post-two/');
		expect(items[1].customData).toContain('media:content');
	});

	it('returns empty array for empty input', () => {
		expect(postsToRssItems([], SITE)).toEqual([]);
	});
});
