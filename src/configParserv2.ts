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
		
		// Filter functions could be optimised
		const lines = this.configText.split('\n')
						.filter((line: string) => line.trim().length != 0)
						.filter((line: string) => !line.trim().startsWith('~'))
                        .filter((line: string) => !line.trim().startsWith('#'));

		let generatedJsonCode = [];
		generatedJsonCode.push('{');

        for (let currentLineIndex = 0; currentLineIndex < lines.length; currentLineIndex++)
        {
            const currentLine = lines[currentLineIndex].trim();
            
			if(currentLine.includes('{'))
			{
				let start = currentLine.replace('{', '').trim();
				generatedJsonCode.push(`"${start}": {`);
				continue;
			}
			
			if(currentLine.includes('}'))
			{
				generatedJsonCode[generatedJsonCode.length - 1] = generatedJsonCode[generatedJsonCode.length - 1].replace(',', '');
				generatedJsonCode.push(currentLine, ',');
				continue;
			}

			if(currentLine.includes(':'))
			{
				let type = currentLine[0];
				let variableName = currentLine.substr(2);

				if(currentLine.includes('='))
				{
					generatedJsonCode.push(`"${variableName}": "${currentLine}",`);
				}
			}
		}

		generatedJsonCode.push('}');
		
		let code = generatedJsonCode.join('\n');
		code = this.removeChar(code, code.lastIndexOf(','));

		this.result = JSON.parse(code);
		console.log(this.result);
	}

	private removeChar(str, char_pos) 
	{
		let part1 = str.substring(0, char_pos);
		let part2 = str.substring(char_pos + 1, str.length);
		return (part1 + part2);
	}

	public getResult(): object 
	{
		return this.result;
	}
}
