import { interpolateName } from 'loader-utils';
import { DOMParser } from 'xmldom';
import Compile from 'yate/compile';

const parser = new DOMParser();

export default function(content) {
	this.cacheable();
	const name = interpolateName(this, "[name]", { content });

	const pool = {};
	const callback = this.async();

	new Compile(parser.parseFromString(content), pool).build(name)
		.then(() => {
			const poolCode = Object.entries(pool).map(([template, code]) => `"${template}":${code}`);

			const result = `
import yate from 'yate';
export default { ${poolCode.join(',')} };
`;

			callback(null, result);
		})
		.catch(error => {
			callback(error);
		});
}

