import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { rehypeLazyImages } from './src/plugins/rehype-lazy-images.mjs';

export default defineConfig({
	site: 'https://superdots.sh',
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => !page.includes('/design-system'),
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
