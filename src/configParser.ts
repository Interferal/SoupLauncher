import { join } from 'path';

import { readFileSync } from 'fs';

export class Config
{
	private file: string;
	private format: string;
	private instanceRoot: string;
	private result: object;
	private configText: string;

	constructor(file: string, format: string = "", instanceRoot: string)
	{
		this.file = file;
		this.format = format;
		this.instanceRoot = instanceRoot;

		if(!this.format)
		{
			const split = file.split('.');
			this.format = split[split.length - 1].toLowerCase();
		}

		this.parse();
	}

	private parse()
	{
		this.result = {};

		const configFilePath = join(this.instanceRoot, 'config', this.file);
		this.configText = readFileSync(configFilePath, 'utf-8');
		
		const lines = this.configText.split('\n').filter((line: string) => line.trim().length != 0);

		for (let currLineIndex = 0; currLineIndex < lines.length; currLineIndex++) 
		{
			const currLine = lines[currLineIndex];
			if(currLine.startsWith('~') || currLine.startsWith('#')) continue;
		
			console.log(currLine);
		}
	}
}