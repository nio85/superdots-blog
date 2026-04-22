import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sizeOf from 'image-size';
import { visit } from 'unist-util-visit';

const publicDir = join(process.cwd(), 'public');

/** Adds loading="lazy", decoding="async", and width/height to all <img> in markdown. */
export function rehypeLazyImages() {
	return (tree) => {
		visit(tree, 'element', (node) => {
			if (node.tagName !== 'img') return;
			node.properties ??= {};
			node.properties.loading ??= 'lazy';
			node.properties.decoding ??= 'async';

			// Add width/height from local images to prevent CLS
			const src = node.properties.src;
			if (src && !node.properties.width && typeof src === 'string' && src.startsWith('/')) {
				try {
					const filePath = join(publicDir, src);
					if (existsSync(filePath)) {
						const dimensions = sizeOf(filePath);
						if (dimensions.width && dimensions.height) {
							node.properties.width = dimensions.width;
							node.properties.height = dimensions.height;
						}
					}
				} catch {
					// Skip if we can't read dimensions
				}
			}
		});
	};
}
