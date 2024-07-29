#!/usr/bin/env node
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import build from './../src/build.js';

const args = process.argv.slice(2);
const files = [];

let asModule = false;
let asBundle = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

for (const arg of args) {
	switch (arg) {
		case '-m':
		case '--module':
			asModule = true;
			break;

		case '-b':
		case '--bundle':
			asBundle = true;
			break;

		default:
			files.push(arg);
	}
}

if (files.length > 0) {
	if (asBundle) {
		const scriptPath = resolve(__dirname, '..', 'src', 'yate.js');

		try {
			const content = fs.readFileSync(scriptPath, { encoding: 'utf8' });
			console.log(content);
		} catch (error) {
			console.error(`Error reading file: ${error.message}`);
			process.exit(1);
		}
	}

	new Promise((resolve, reject) => {
		build(files, asModule)
			.then(result => {
				console.log(result);
				resolve(result);
			})
			.catch(error => {
				console.error('Error during build:', error);
				reject(error);
			});
	});
} else {
	console.log("Usage: yate file1.yat [...file2.yat] [options]");
	console.log("       yate file1.yat -m");
	console.log("Options:");
	console.log("  -m, --module     build as module");
	console.log("  -b, --bundle     generate bundle code with injected yate.js");
	console.log("Error: No input files provided.");
	console.log("Please provide at least one .yat file to process.");
}

