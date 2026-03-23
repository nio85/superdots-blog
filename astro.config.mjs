import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { rehypeLazyImages } from './src/plugins/rehype-lazy-images.mjs';
import { rehypeResponsiveTables } from './src/plugins/rehype-responsive-tables.mjs';
import fs from 'node:fs';
import path from 'node:path';

// Build-time date for static pages without explicit lastmod
const buildDate = new Date().toISOString().slice(0, 10);

// Build a slug → lastmod map from blog frontmatter at config time
const blogDir = path.resolve('./src/content/blog');
const lastmodMap = new Map();
for (const file of fs.readdirSync(blogDir)) {
	if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
	const raw = fs.readFileSync(path.join(blogDir, file), 'utf-8');
	const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) continue;
	const fm = match[1];
	const updated = fm.match(/updatedDate:\s*['"]?(\d{4}-\d{2}-\d{2})['"]?/);
	const pub = fm.match(/pubDate:\s*['"]?(\d{4}-\d{2}-\d{2})['"]?/);
	const date = updated?.[1] || pub?.[1];
	if (date) {
		const slug = file.replace(/\.(md|mdx)$/, '');
		lastmodMap.set(`https://superdots.sh/blog/${slug}/`, date);
	}
}

export default defineConfig({
	site: 'https://superdots.sh',
	trailingSlash: 'always',
	compressHTML: true,
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => !page.includes('/design-system') && !page.includes('/analytics-optout'),
			serialize(item) {
				const lastmod = lastmodMap.get(item.url);
				item.lastmod = lastmod || buildDate;

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
					// Pillar pages
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
			},
		}),
	],
	image: {
		// Sharp is the default service in Astro 4.x
		service: { entrypoint: 'astro/assets/services/sharp' },
	},
	markdown: {
		rehypePlugins: [rehypeResponsiveTables, rehypeLazyImages],
	},
	server: {
		host: '0.0.0.0',
	},
	vite: {
		cacheDir: '.vite-cache',
		server: {
			allowedHosts: true,
		},
		preview: {
			allowedHosts: true,
		},
	},
});
