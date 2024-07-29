import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const varRegexp = /(\{\{.+?\}\})/g;

export const compileTemplate = readFileSync(
  resolve(__dirname, './compile.template.js'),
  { encoding: 'utf8' }
);

const directAttributes = [
  '*.id', '*.title',
  'input.name', 'input.value', 'input.type',
  'a.href', 'a.target', 'form.method', 'form.action',
  'img.src', 'img.srcset', 'img.alt', 'img.width', 'img.height',
  'input.checked', 'input.selected'
];

const isDirectAttribute = (element, attribute) => {
  return directAttributes.includes(`${element}.${attribute}`)
    || directAttributes.includes(`*.${attribute}`);
};

const svgElements = [
  'svg', 'a', 'altGlyph', 'altGlyphDef', 'altGlyphItem', 'animate',
  'animateColor', 'animateMotion', 'animateTransform', 'circle',
  'clipPath', 'color-profile', 'cursor', 'defs', 'desc', 'ellipse',
  'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite',
  'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
  'feDistantLight', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG',
  'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode',
  'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting',
  'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'font',
  'font-face', 'font-face-format', 'font-face-name', 'font-face-src',
  'font-face-uri', 'foreignObject', 'g', 'glyph', 'glyphRef',
  'hkern', 'image', 'line', 'linearGradient', 'marker', 'mask',
  'metadata', 'missing-glyph', 'mpath', 'path', 'pattern',
  'polygon', 'polyline', 'radialGradient', 'rect', 'script',
  'set', 'stop', 'style', 'switch', 'symbol', 'text', 'textPath',
  'title', 'tref', 'tspan', 'use', 'view', 'vkern'
];

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
		return token.substring(2).split('}}').shift().trim();
	}

	parseTokens(str) {
		return str.match(varRegexp) || [];
	}

	collectVars(tokens, updateCode) {
		const replacement = {};
		tokens.forEach(token => {
			const param = this.varName(token);
			const key = param.split('.').shift();
			if (!this.collector.vars[key]) {
				this.collector.vars[key] = {
					names: {},
					funcs: []
				};
			}

			if (!this.collector.vars[key].names[param]) {
				this.collector.vars[key].names[param] = `v${Object.keys(this.collector.vars).length}`;
				if (key !== param) {
					this.collector.vars[key].names[param] += `_${Object.keys(this.collector.vars[key].names).length}`;
				}
			}

			replacement[token] = this.collector.vars[key].names[param];
		});

		const funcIndex = this.collector.funcs.push(updateCode.replace(
			varRegexp,
			m => `"+${replacement[m]}+"`
		).replace('""+', '').replace('+""', '')) - 1;

		for (const [token, replaceValue] of Object.entries(replacement)) {
			const param = this.varName(token);
			const key = param.split('.').shift();
			this.collector.vars[key].funcs.push(funcIndex);
		}
	}

	string(str) {
		return `"${str.replace(/(?:||)/g, '').replace(/^\s+|\s+$/g, '')}"`;
	}

	trimVars(str) {
		return str.replace(varRegexp, '');
	}

	node(n, pName) {
		const stack = [[n, pName]];

		while (stack.length > 0) {
			const [currentNode, currentParent] = stack.pop();
			const nId = this.newId();
			const nName = `n${nId}`;
			let text, hasPlainText;

			switch (currentNode.nodeType) {
				case 9: // Document
					if (currentNode.firstChild) {
						stack.push([currentNode.firstChild, currentParent]);
					}
					break;

				case 3: // Text
					text = this.string(currentNode.nodeValue);

					this.collectVars(this.parseTokens(text), `${nName}.textContent=${text}`);
					this.collector.init.push(`${nName}=document.createTextNode(${this.trimVars(text)})`);
					this.collector.dom.push(`${currentParent}.appendChild(${nName})`);
					break;

				case 1: // Element
					let p, attr, k, childrenVar, afterName, renderMethod, isSvg;
					for (let i = 0; i < currentNode.attributes.length; i++) {
						switch (currentNode.attributes[i].nodeName) {
							case 'when':
								attr = currentNode.attributes[i].nodeName;
								p = currentNode.getAttribute(attr);
								currentNode.removeAttribute(attr);
								k = `${attr}${Object.keys(this.templates).length - 1}`;
								childrenVar = `${k}c`;
								new Compile(currentNode, this.templates).build(k);

								afterName = `a${nId}`;
								this.collector.init.push(`${afterName}=document.createTextNode("")`);
								this.collector.dom.push(`${currentParent}.appendChild(${afterName})`);

								this.collectVars(
									[`{{${p}}}`],
									`yate.renderWhen("${k}",${afterName},"{{${p}}}",pool,${childrenVar})`
								);
								this.collector.children.push(childrenVar);
								break;
							case 'if':
							case 'for':
								attr = currentNode.attributes[i].nodeName;
								p = currentNode.getAttribute(attr);
								currentNode.removeAttribute(attr);
								k = `${attr}${Object.keys(this.templates).length - 1}`;
								childrenVar = `${k}c`;
								new Compile(currentNode, this.templates).build(k);

								afterName = `a${nId}`;
								this.collector.init.push(`${afterName}=document.createTextNode("")`);
								this.collector.dom.push(`${currentParent}.appendChild(${afterName})`);

								renderMethod = (attr === 'if' ? 'renderChild' : 'renderChildren');
								this.collectVars(
									[`{{${p}}}`],
									`yate.${renderMethod}("${k}",${afterName},"{{${p}}}",pool,${childrenVar})`
								);
								this.collector.children.push(childrenVar);
								break;
						}
					}

					if (!p) {
						isSvg = svgElements.includes(currentNode.tagName);
						if (isSvg) {
							this.collector.init.push(`${nName}=document.createElementNS("http://www.w3.org/2000/svg", "${currentNode.tagName}")`);
						} else {
							this.collector.init.push(`${nName}=document.createElement("${currentNode.tagName}")`);
						}

						if (currentNode.attributes) {
							for (let i = 0; i < currentNode.attributes.length; i++) {
								text = this.string(currentNode.attributes[i].value);
								hasPlainText = (this.trimVars(text) !== '""');
								this.collectVars(
									this.parseTokens(text),
									(hasPlainText
										? ''
										: `if (${text} === false) {${nName}.removeAttribute("${currentNode.attributes[i].name}"); return;}`) +
										(!isSvg && isDirectAttribute(currentNode.nodeName, currentNode.attributes[i].name)
											? `${nName}.${currentNode.attributes[i].name} = ${text}`
											: (currentNode.attributes[i].name === 'xlink:href'
												? `${nName}.setAttributeNS("http://www.w3.org/1999/xlink", "href",${text})`
												: `${nName}.setAttribute("${currentNode.attributes[i].name}",${text})`
											)
										)
								);

								if (hasPlainText) {
									this.collector.dom.push(currentNode.attributes[i].name === 'xlink:href'
										? `${nName}.setAttributeNS("http://www.w3.org/1999/xlink", "href",${this.trimVars(text)})`
										: `${nName}.setAttribute("${currentNode.attributes[i].name}",${this.trimVars(text)})`
									);
								}
							}
						}
						this.collector.dom.push(`${currentParent}.appendChild(${nName})`);

						if (currentNode.childNodes) {
							for (let i = currentNode.childNodes.length - 1; i >= 0; i--) {
								stack.push([currentNode.childNodes[i], nName]);
							}
						}
					}
					break;
			}
		}
	}

	build(template) {
		this.templates[template] = '';
		this.node(this.xmlTree, 'root');

		const updateCode = [];
		const initCode = [];

		for (const [param, varData] of Object.entries(this.collector.vars)) {
			const defCode = [];

			for (const [name, defName] of Object.entries(varData.names)) {
				const parts = name.split('.');
				parts[0] = 'a';

				defCode.push(`${defName}=${parts.join('.')}`);
				this.collector.init.push(`${defName}=""`);
			}

			updateCode.push(
				`"${param}":` +
					`function(a){` +
					`${defCode.join(';')};` +
					`f[${varData.funcs.join(']();f[')}]();` +
					`}`
			);
		}

		const funcCode = this.collector.funcs.map((func, index) =>
			`${index}:function(){${func}}`
		);

		this.collector.children.forEach(child => {
			this.collector.init.push(`${child}=[]`);
		});

		this.templates[template] = compileTemplate.replace(
			/\{\{[a-z\_]+\}\}/g,
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

