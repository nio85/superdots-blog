import fs from 'node:fs';
import path from 'node:path';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { parseFrontmatterDates, sitemapFilter, sitemapSerialize } from './src/lib/sitemap.ts';
import { rehypeLazyImages } from './src/plugins/rehype-lazy-images.mjs';
import { rehypeResponsiveTables } from './src/plugins/rehype-responsive-tables.mjs';
import { rehypeTrailingSlash } from './src/plugins/rehype-trailing-slash.mjs';

// Build-time date for static pages without explicit lastmod
const buildDate = new Date().toISOString().slice(0, 10);

// Build a slug → lastmod map from blog frontmatter at config time
const blogDir = path.resolve('./src/content/blog');
const lastmodMap = new Map();
const noindexSlugs = new Set();
for (const file of fs.readdirSync(blogDir)) {
	if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
	const raw = fs.readFileSync(path.join(blogDir, file), 'utf-8');
	const { pubDate: pub, updatedDate: updated, noindex } = parseFrontmatterDates(raw);
	const date = updated || pub;
	const slug = file.replace(/\.(md|mdx)$/, '');
	if (pub && pub > buildDate) {
		noindexSlugs.add(`https://superdots.sh/blog/${slug}/`);
		continue;
	}
	if (date) {
		lastmodMap.set(`https://superdots.sh/blog/${slug}/`, date);
	}
	if (noindex) {
		noindexSlugs.add(`https://superdots.sh/blog/${slug}/`);
	}
}

export default defineConfig({
	site: 'https://superdots.sh',
	trailingSlash: 'always',
	compressHTML: true,
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => sitemapFilter(page, noindexSlugs),
			serialize: (item) => sitemapSerialize(item, lastmodMap, buildDate),
		}),
	],
	image: {
		// Sharp is the default service in Astro 4.x
		service: { entrypoint: 'astro/assets/services/sharp' },
	},
	markdown: {
		rehypePlugins: [rehypeResponsiveTables, rehypeLazyImages, rehypeTrailingSlash],
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
