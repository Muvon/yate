const yate = (() => {
	const pool = (templates) => {
		const methods = {
			get: (template, data) => {
				const t = templates[template](methods);
				if (data) {
					t.dom();
					t.update(data);
				}
				return t;
			},
			release: (template, instance) => {
				instance.remove();
			}
		};

		return methods;
	};

	const renderChild = (template, node, data, pool, children) => {
		renderChildren(template, node, data ? [data] : [], pool, children);
	};

	const renderChildren = (template, node, data = [], pool, children) => {
		const dataLength = data.length;
		const childrenLength = children.length;

		// Remove excess children
		for (let i = childrenLength - 1; i >= dataLength; i--) {
			pool.release(template, children.pop());
		}

		// Update existing children
		children.forEach((child, i) => child.update(data[i]));

		// Add new children if needed
		if (childrenLength < dataLength) {
			const fragment = document.createDocumentFragment();

			for (let i = childrenLength; i < dataLength; i++) {
				const nested = pool.get(template);
				children.push(nested);
				fragment.appendChild(nested.dom());
				nested.update(data[i]);
			}

			node.parentNode.insertBefore(fragment, node);
		}
	};

	return { pool, renderChildren, renderChild };
})();

// For browser environments
if (typeof window !== 'undefined') {
	window.yate = yate;
}

// For Node.js environments
if (typeof module !== 'undefined' && module.exports) {
	module.exports = yate;
}
