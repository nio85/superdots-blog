export interface SitemapItem {
	url: string;
	lastmod?: string;
	changefreq?: string;
	priority?: number;
}

const EXCLUDED_PATTERNS = ['/design-system', '/analytics-optout', '/tags/', '/category/', '/404'];

export function sitemapFilter(page: string, noindexSlugs: Set<string>): boolean {
	if (noindexSlugs.has(page)) return false;
	return !EXCLUDED_PATTERNS.some((pattern) => page.includes(pattern));
}

export function sitemapSerialize(item: SitemapItem, lastmodMap: Map<string, string>, buildDate: string): SitemapItem {
	const lastmod = lastmodMap.get(item.url);
	const raw = lastmod || buildDate;
	item.lastmod = raw > buildDate ? buildDate : raw;

	const url = item.url;
	if (url === 'https://superdots.sh/') {
		item.changefreq = 'weekly';
		item.priority = 1.0;
	} else if (url === 'https://superdots.sh/blog/') {
		item.changefreq = 'daily';
		item.priority = 0.9;
	} else if (url === 'https://superdots.sh/guides/') {
		item.changefreq = 'weekly';
		item.priority = 0.85;
	} else if (url.includes('/blog/ai-for-')) {
		item.changefreq = 'weekly';
		item.priority = 0.8;
	} else if (url.includes('/blog/')) {
		item.changefreq = 'monthly';
		item.priority = 0.7;
	} else {
		item.changefreq = 'monthly';
		item.priority = 0.5;
	}

	return item;
}

export function parseFrontmatterDates(raw: string): {
	pubDate?: string;
	updatedDate?: string;
	noindex: boolean;
} {
	const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return { noindex: false };
	const fm = match[1];
	const updated = fm.match(/updatedDate:\s*['"]?(\d{4}-\d{2}-\d{2})['"]?/);
	const pub = fm.match(/pubDate:\s*['"]?(\d{4}-\d{2}-\d{2})['"]?/);
	return {
		pubDate: pub?.[1],
		updatedDate: updated?.[1],
		noindex: /noindex:\s*true/.test(fm),
	};
}
