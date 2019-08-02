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
		let calculatedPlusDepth = 0;
		let calculatedMinusDepth = 0;
		for (let currLineIndex = 0; currLineIndex < lines.length; currLineIndex++) 
		{
			const currLine = lines[currLineIndex];
			if(currLine.includes('{')) calculatedPlusDepth++;
			if(currLine.includes('}')) calculatedMinusDepth++;
		}

		if(calculatedPlusDepth != calculatedMinusDepth)
		{
			this.result = {parseError: "Depth was not equal to zero, missing closing/opening curly bracket somewhere..."};
			return;
		}

		let codeBlocks = {};
		let depth = -1;
		let codeBlockNames = [];
		let codeBlockDepths = {};
		for (let currLineIndex = 0; currLineIndex < lines.length; currLineIndex++) 
		{
			const currLine = lines[currLineIndex].trim();

			if(currLine.endsWith('{') || currLine == '{')
			{
				depth++;
				let name = currLine.endsWith('{') ? currLine.replace('{', '').trim() : lines[currLineIndex - 1].trim();
				codeBlockNames.push(name);
				codeBlockDepths[name] = depth;
				//console.log(name + ' at depth ' + depth);
				codeBlocks[name] = {start: currLineIndex};
			}
			if(currLine == '}')
			{
				let index = codeBlockNames[codeBlockNames.length - 1];
				if(currLineIndex == lines.length - 1)
				{
					console.log('last line');
					index = codeBlockNames[0];
				}
				codeBlocks[index].end = currLineIndex;
				codeBlocks[index].depth = depth;
				codeBlocks[index].code = this.getLinesBetween(lines, codeBlocks[index].start, codeBlocks[index].end);
				codeBlocks[index].name = index;
				codeBlocks[index].fqname = index;

				if(depth != 0)
				{						
					let values = Object.values(codeBlockDepths).reverse();
					let stopAtIndex = codeBlocks[index].depth - 1;
					
					for (let i = 0; i < values.length; i++) 
					{
						const currDepthIndex = values[i];
	
						if(currDepthIndex == stopAtIndex)
						{
							codeBlocks[index].fqname = Object.keys(codeBlockDepths).reverse()[i] + "." + codeBlocks[index].name;
							//console.log(codeBlocks[index].fqname);
							break;
						}
					}
				}

				depth--;
				continue;
			}
		}

		let resultingLines = [];
		checkNextLine: for (let currLineIndex = 0; currLineIndex < lines.length; currLineIndex++) 
		{
			const currLine = lines[currLineIndex];

			if(currLine.includes('{') || currLine.includes('}')) continue;

			for (let name in codeBlocks) 
			{
				let codeBlock = codeBlocks[name];
				if(!codeBlock.code) continue;
				for (let i = 0; i < codeBlock.code.length; i++) 
				{
					const line = codeBlock.code[i];
					if(currLine.trim() == line.trim() || line.includes('{') || line.includes('}')) break checkNextLine; 
				}
				resultingLines.push(currLine.trim());
			}
		}


		this.result = this.parseCodeBlock(resultingLines);

		for (let name in codeBlocks) 
		{
			let codeBlock = codeBlocks[name];
			if(!codeBlock.code) continue;
			if(name == 'commands')
			{
				console.log(codeBlock);
				return;
			}
			let split =  codeBlock.fqname.split('.');
			console.log('Parsing ' + split.join(' -> '));
			
			const first = split[0];
			const second = split[1];

			if(first && !second)
			{
				console.log('got first ');
				this.result[first] = this.parseCodeBlock(codeBlock.code);
			}

			if(first && second)
			{
				if(this.result[first] === undefined) this.result[first] = {};

				console.log('got second ');
				this.result[first][second] = this.parseCodeBlock(codeBlock.code);
			}
		}

		console.log('leftover lines: ');
		console.log(resultingLines);

		console.log('----------RESULT--------------');
		console.log(this.result);
	}

	private getLinesBetween(lines, start, end) 
	{
		let result = [];

		for (let i = start; i < end; i++)
		{
			const line = lines[i];
			if(line.includes('{') || line.includes('}')) continue;

			result.push(line.trim());
		}

		return result;
	}

	private parseCodeBlock(code): object
	{
		let parseResult = {};

		for (let i = 0; i < code.length; i++) 
		{
			const line = code[i];
			
			let type = line.trim()[0].toLowerCase();
			let tokens = line.substr(2).split('=');

			if(line.includes('<'))
			{
				let items = [];
				let name = line.trim().substr(2).split('<')[0].trim();
				console.log('reading array ' + name);
				let x = i + 1;
				for (; x < code.length; x++) 
				{
					const lin = code[x].trim();
					if(lin == '>') break;
					items.push(lin);
				}
				i = x;

				if(type == 'i')
				{
					for (let ii = 0; ii < items.length; ii++) 
					{
						items[ii] = parseInt(items[ii]);
					}
				}

				if(type == 'd' || type == 'f')
				{
					for (let ii = 0; ii < items.length; ii++) 
					{
						items[ii] = parseFloat(items[ii]);
					}
				}

				parseResult[name] = items;
			} else
			{
				switch (type) 
				{
					case 'i':
					{
						parseResult[tokens[0].trim()] = parseInt(tokens[1].trim());
						break;	
					}

					case 'b':
					{
						parseResult[tokens[0].trim()] = tokens[1].trim() == 'true';
						break;	
					}

					case 'f':
					case 'd':
					{
						parseResult[tokens[0].trim()] = parseFloat(tokens[1].trim());
						break;	
					}

					case 's':
					{
						parseResult[tokens[0].trim()] = tokens[1].trim();
						break;	
					}
				
					default:
						console.log('type ' + type + ' not understood.');
						break;
				}
			}
		}

		console.log(parseResult);
		return parseResult;
	}

	public getResult(): object 
	{
		return this.result;
	}
}