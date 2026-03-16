import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { rehypeLazyImages } from './src/plugins/rehype-lazy-images.mjs';
import fs from 'node:fs';
import path from 'node:path';

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
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => !page.includes('/design-system'),
			serialize(item) {
				const lastmod = lastmodMap.get(item.url);
				if (lastmod) item.lastmod = lastmod;
				return item;
			},
		}),
	],
	image: {
		// Sharp is the default service in Astro 4.x
		service: { entrypoint: 'astro/assets/services/sharp' },
	},
	markdown: {
		rehypePlugins: [rehypeLazyImages],
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
