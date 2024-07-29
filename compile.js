import { readFileSync } from 'fs';
import { resolve } from 'path';

const VAR_REGEXP = /(\{[^{}]+?\})/g;
const COMPILE_TEMPLATE = readFileSync(resolve('./compile.template.js'), { encoding: 'utf8' });

const DIRECT_ATTRIBUTES = new Set([
	'*.id', '*.title',
	'input.name', 'input.value', 'input.type',
	'a.href', 'a.target', 'form.method', 'form.action',
	'img.src', 'img.srcset', 'img.alt', 'img.width', 'img.height',
	'input.checked', 'input.selected'
]);

const isDirectAttribute = (element, attribute) =>
	DIRECT_ATTRIBUTES.has(`${element}.${attribute}`) || DIRECT_ATTRIBUTES.has(`*.${attribute}`);

const SVG_ELEMENTS = new Set([
	'svg', 'rect', 'circle', 'ellipse', 'line',
	'polyline', 'polygon', 'path', 'text', 'g', 'use',
	'defs', 'animate', 'animateMotion', 'animateTransform',
	'clipPath', 'desc', 'discard', 'feBlend', 'feColorMatrix',
	'feComponentTransfer', 'feComposite', 'feConvolveMatrix',
	'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight',
	'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG',
	'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode',
	'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting',
	'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'foreignObject',
	'image', 'linearGradient', 'marker', 'mask', 'metadata',
	'mpath', 'pattern', 'radialGradient', 'script', 'set',
	'stop', 'style', 'switch', 'symbol', 'textPath', 'title',
	'tspan', 'view'
]);

class Compile {
	constructor(xmlTree, templates) {
		this.xmlTree = xmlTree;
		this.templates = templates;
		this.lid = 0;
		this.collector = {
			vars: {},
			children: [],
			funcs: [],
			init: [],
			dom: []
		};
	}

	newId() {
		return (this.lid++).toString(16);
	}

	varName(token) {
		return token.substring(2).split('}}')[0].trim();
	}

	parseTokens(str) {
		return str.match(VAR_REGEXP) || [];
	}

	collectVars(tokens, updateCode) {
		const replacement = {};
		tokens.forEach(token => {
			const param = this.varName(token);
			const keys = param.split('.');
			let currentObj = this.collector.vars;

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];
				if (!currentObj[key]) {
					currentObj[key] = { names: {}, funcs: [] };
				}
				currentObj = currentObj[key];
			}

			if (!currentObj.names[param]) {
				currentObj.names[param] = `v${Object.keys(this.collector.vars).length}_${Object.keys(currentObj.names).length}`;
			}

			replacement[token] = currentObj.names[param];
		});

		const funcIndex = this.collector.funcs.push(updateCode.replace(
			VAR_REGEXP,
			m => replacement[m] ? `"+${replacement[m]}+"` : m
		).replace('""+', '').replace('+""', '')) - 1;

		Object.entries(replacement).forEach(([token, value]) => {
			const param = this.varName(token);
			const keys = param.split('.');
			let currentObj = this.collector.vars;

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];
				if (!currentObj[key]) {
					currentObj[key] = { names: {}, funcs: [] };
				}
				currentObj = currentObj[key];
			}

			if (!currentObj.funcs) {
				currentObj.funcs = [];
			}
			currentObj.funcs.push(funcIndex);
		});
	}

	string(str) {
		return `"${str.replace(/(?:\r\n|\r|\n|\t)/g, '').trim()}"`;
	}

	trimVars(str) {
		return str.replace(VAR_REGEXP, '');
	}

	varName(token) {
		return token.substring(1, token.length - 1).trim();
	}

	parseTokens(str) {
		return str.match(VAR_REGEXP) || [];
	}

	processNode(n, pName) {
		const stack = [[n, pName]];

		while (stack.length > 0) {
			const [currentNode, parentName] = stack.pop();
			const nId = this.newId();
			const nName = `n${nId}`;

			switch (currentNode.nodeType) {
				case 9: // Document
					if (currentNode.firstChild) {
						stack.push([currentNode.firstChild, parentName]);
					}
					break;

				case 3: // Text
					const text = this.string(currentNode.nodeValue);
					this.collectVars(this.parseTokens(text), `${nName}.textContent=${text}`);
					this.collector.init.push(`${nName}=document.createTextNode(${this.trimVars(text)})`);
					this.collector.dom.push(`${parentName}.appendChild(${nName})`);
					break;

				case 1: // Element
					let isSvg = SVG_ELEMENTS.has(currentNode.tagName);
					this.collector.init.push(isSvg
						? `${nName}=document.createElementNS("http://www.w3.org/2000/svg", "${currentNode.tagName}")`
						: `${nName}=document.createElement("${currentNode.tagName}")`
					);

					if (currentNode.attributes && currentNode.attributes.length > 0) {
						for (let i = 0; i < currentNode.attributes.length; i++) {
							const a = currentNode.attributes[i];
							console.log(a, a.name, a.value);
							const text = this.string(a.value)
							const hasPlainText = this.trimVars(text) !== '""';
							this.collectVars(
								this.parseTokens(text),
								(hasPlainText
									? ''
									: `if (${text} === false) {${nName}.removeAttribute("${a.name}"); return;}`
								) + (!isSvg && isDirectAttribute(currentNode.nodeName, a.name)
										? `${nName}.${a.name} = ${text}`
										: (a.name === 'xlink:href'
											? `${nName}.setAttributeNS("http://www.w3.org/1999/xlink", "href",${text})`
											: `${nName}.setAttribute("${a.name}",${text})`
										)
									)
							);

							if (hasPlainText) {
								this.collector.dom.push(a.name === 'xlink:href'
									? `${nName}.setAttributeNS("http://www.w3.org/1999/xlink", "href",${this.trimVars(text)})`
									: `${nName}.setAttribute("${a.name}",${this.trimVars(text)})`
								);
							}
						}
					}
					this.collector.dom.push(`${parentName}.appendChild(${nName})`);

					if (currentNode.childNodes) {
						for (let i = currentNode.childNodes.length - 1; i >= 0; i--) {
							stack.push([currentNode.childNodes[i], nName]);
						}
					}
					break;
			}
		}
	}

	build(template) {
		this.templates[template] = '';
		this.processNode(this.xmlTree, 'root');

		const updateCode = [];
		const initCode = [];

		const processVars = (obj, path = []) => {
			for (const [key, value] of Object.entries(obj)) {
				if (key === 'names' || key === 'funcs') continue;

				const currentPath = [...path, key];
				const defCode = [];

				for (const [name, defName] of Object.entries(value.names)) {
					const parts = ['a', ...name.split('.').slice(currentPath.length)];
					defCode.push(`${defName}=${parts.join('.')}`);
					this.collector.init.push(`${defName}=""`);
				}

				updateCode.push(
					`"${currentPath.join('.')}":function(a){${defCode.join(';')};f[${value.funcs.join(']();f[')}]();}`
				);

				processVars(value, currentPath);
			}
		};

		processVars(this.collector.vars);

		const funcCode = this.collector.funcs.map((func, index) => `${index}:function(){${func}}`);

		this.collector.children.forEach(child => {
			this.collector.init.push(`${child}=[]`);
		});

		this.templates[template] = COMPILE_TEMPLATE.replace(
			/\{\{[a-z_]+\}\}/g,
			m => ({
				'{{var_code}}': this.collector.init.join(','),
				'{{func_code}}': funcCode.join(','),
				'{{update_code}}': updateCode.join(','),
				'{{dom_code}}': this.collector.dom.join(';')
			})[m]
		);
	}
}

export default Compile;

