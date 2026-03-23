import { visit } from 'unist-util-visit';

/** Wraps every <table> in a scrollable <div class="table-scroll"> container. */
export function rehypeResponsiveTables() {
	return (tree) => {
		visit(tree, 'element', (node, index, parent) => {
			if (node.tagName !== 'table' || !parent) return;

			const wrapper = {
				type: 'element',
				tagName: 'div',
				properties: { className: ['table-scroll'] },
				children: [node],
			};

			parent.children[index] = wrapper;
			return 'skip';
		});
	};
}
