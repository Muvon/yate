import { DOMParser } from 'xmldom';
import Compile from './compile.js';
import { promises as fs } from 'fs';

const parser = new DOMParser();

const processFiles = async (files, asModule) => {
	const fileArray = Array.isArray(files) ? files : [files];

	const pool = {};
	await Promise.all(fileArray.map(async (file) => {
		const content = await fs.readFile(file, 'utf8');
		const parsed = parser.parseFromString(content);
		const fileName = file.split('/').pop().split('.')[0];
		await new Compile(parsed, pool).build(fileName);
	}));

	const poolCode = Object.entries(pool)
	.map(([template, code]) => `"${template}":${code}`)
	.join(',');

	const moduleCode = `
const yate = require("yate");
module.exports = {${poolCode}};
`;

	const windowCode = `
const templateList = {${poolCode}};
window.templates = yate.pool(templateList);
`;

	return asModule ? moduleCode : windowCode;
};

export default async function (files, asModule) {
	return processFiles(files, asModule);
}

