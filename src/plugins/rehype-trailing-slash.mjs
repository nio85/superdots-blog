import { visit } from 'unist-util-visit';

/**
 * Rehype plugin that ensures all internal links end with a trailing slash.
 * Prevents URL duplication in search engines (e.g., /blog/slug vs /blog/slug/).
 */
export function rehypeTrailingSlash() {
	return (tree) => {
		visit(tree, 'element', (node) => {
			if (node.tagName !== 'a') return;
			const href = node.properties?.href;
			if (typeof href !== 'string') return;

			// Only process internal paths (start with /)
			// Skip anchors, external URLs, and special paths
			if (!href.startsWith('/')) return;

			// Separate path from hash/query
			const hashIdx = href.indexOf('#');
			const queryIdx = href.indexOf('?');
			const sepIdx = hashIdx === -1 ? queryIdx : queryIdx === -1 ? hashIdx : Math.min(hashIdx, queryIdx);

			const path = sepIdx === -1 ? href : href.slice(0, sepIdx);
			const suffix = sepIdx === -1 ? '' : href.slice(sepIdx);

			// Skip if already has trailing slash, or is root, or has a file extension
			if (path.endsWith('/') || path === '/' || /\.\w+$/.test(path)) return;

			node.properties.href = path + '/' + suffix;
		});
	};
}
