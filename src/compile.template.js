function(pool) {
	'use strict';

	let {{var_code}};
	const f = {
		{{func_code}}
	};
	const u = {
		{{update_code}}
	};

	let root = document.createDocumentFragment();

	function createDom() {
		if (!root.childNodes.length) {
		{{dom_code}};
		}
		return root;
	}

	function updateDom(a) {
		if (a && typeof a === 'object') {
			Object.entries(a).forEach(([key, value]) => {
				if (u[key]) {
					u[key](value);
				} else {
					console.warn(`Unused var: {${key}}`);
				}
			});
		}
	}

	function removeDom() {
		if (n0 && n0.parentNode) {
			n0.parentNode.removeChild(n0);
		}
	}

	return {
		dom: createDom,
		update: updateDom,
		remove: removeDom
	};
}
