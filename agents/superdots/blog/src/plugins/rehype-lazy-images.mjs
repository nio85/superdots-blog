import { visit } from 'unist-util-visit';

/** Adds loading="lazy" and decoding="async" to all <img> in markdown. */
export function rehypeLazyImages() {
	return (tree) => {
		visit(tree, 'element', (node) => {
			if (node.tagName !== 'img') return;
			node.properties ??= {};
			node.properties.loading ??= 'lazy';
			node.properties.decoding ??= 'async';
		});
	};
}
