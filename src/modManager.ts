const path = require('path');
const twitchappapi = require('twitchappapi');
const instanceManager = require('../../dest/instanceManager.js');
const fetch = require('node-fetch');

import { Forge } from '@xmcl/minecraft-launcher-core';
import { shell, ipcRenderer, remote } from 'electron';

// @ts-ignore
import { Config } from '../../dest/configParserv2';

let instances = instanceManager.getInstances();
var $_GET: any = {};
if(document.location.toString().indexOf('?') !== -1) {
	var query = document.location.toString().replace(/^.*?\?/, '').replace(/#.*$/, '').split('&');

	for(var i=0, l=query.length; i<l; i++) {
		var aux = decodeURIComponent(query[i]).split('=');
		$_GET[aux[0]] = aux[1];
	}
}

let instName = $_GET['name'];
if(!instName)
{
	window.close();
}

let inst = instances[instName];
if(!inst) window.close();
if(inst.info.downloading) 
{
	alert('instance still downloading!'); 
	window.close();
}

let doc: any = document.getElementById('title');
doc.innerHTML += inst.info.displayName;

function resize()
{
	document.getElementById("sidebarnav").style.height = document.documentElement.scrollHeight + "px";
}

resize();
window.onresize = resize;
window.onscroll = resize;

function injectIntoContainer(data: string)
{
	let elem: any = document.getElementById('container');
	while (elem.firstChild) elem.removeChild(elem.firstChild);
	elem.innerHTML = data;
}

let modsList: any;
let mods: any;
async function updateModListCache()
{
	modsList = await resolveModList(path.join(instanceManager.getWorkingDir(), 'instances', inst.folder, 'mods'));
}

async function init()
{
	injectIntoContainer('<img style="" src="img/loading.gif">');
	updateModList();
	showInstalledMods();
}
init();

async function deleteModFromInstance(modJar)
{
	let modProfile = mods[modJar];

	if(!modProfile)
	{
		modProfile = {};
		modProfile.disabled = modJar.endsWith('.disabled');
	}

	let fs = require('fs');
	fs.unlinkSync(path.join(instanceManager.getWorkingDir(), 'instances', inst.folder, 'mods', modProfile.disabled ? modJar+'.disabled':modJar));
	delete mods[modJar];
	saveModList();
}

var filesystem = require('fs');

async function showConfigEditor()
{
	let elemxd: any = document.getElementById('filterMods');
	elemxd.style.display = 'none';
	let elemxd2: any = document.getElementById('searchMods');
	elemxd2.style.display = 'none';

	let code = "";

	let folder = path.join(instanceManager.getWorkingDir(), 'instances', inst.folder, 'config');
	let files = ['AppliedEnergistics2/AppliedEnergistics2.cfg'];//await getConfigFilesInDirectory(folder);
	let idToFile = {};
	

	for(let file in files)
	{
		file = files[file];
		const fileSplit = file.split('.');

		let id = "a"+uuidv4();

		code += 
		`
			<div class="configeditor-container">
				<div class="configeditor-div">
					<i class="fas fa-angle-double-down" id="${id}-i" onclick="expand(this, '${id}');" style="cursor: pointer;"></i>
					<span>${file}</span>
					<br>
					<div id="${id}" style="overflow: hidden;" class="configeditor-content">
						${(await generateHTMLEditorCodeFor(file, id))}
					</div>
				</div>
			</div>
		`;

		idToFile[id] = file;
	}

	injectIntoContainer
	(`
		<div style="margin-top: 40px;">${code}</div>
	`);

	for(let id in idToFile)
	{
		document.getElementById(id).setAttribute('data-height', document.getElementById(id).clientHeight.toString());
		// @ts-ignore
		anime
		({
			targets: '#'+id,
			height: 0
		});
	}
}

function uuidv4() 
{
	// @ts-ignore
	return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

async function generateHTMLEditorCodeFor(file, id)
{
	const fileSplit = file.split('.');
	const extention = fileSplit[fileSplit.length - 1].toLowerCase();
	//let content = filesystem.readFileSync(, 'utf8');
	let instanceRoot = path.join(instanceManager.getWorkingDir(), 'instances', inst.folder);
	
	switch(extention)
	{
		case 'cfg':
		{
			//console.log(file);
			
			let config = new Config(file, extention, instanceRoot);
			let result = config.getResult();

			if(result.parseError)
			{
				return "<b>Config parsing error: </b>" + result.parseError;
			}

			break;
		}

		default:
		{
			return "Unsupported filetype: " + extention;
			break;
		}
	}
}

function expand(elem, uuid)
{
	const contentDiv = document.getElementById(uuid);
	//contentDiv.classList.toggle('configeditor-hidden');
	elem.classList.toggle('rot180');
	if(elem.classList.contains('rot180'))
	{	
		console.log('expand');
		// @ts-ignore
		anime
		({
			targets: '#'+uuid,
			height: parseInt(contentDiv.getAttribute('data-height'))
		});
	} else
	{
		console.log('collapse');
		// @ts-ignore
		anime
		({
			targets: '#'+uuid,
			height: 0
		});	
	}
}

function launchInstance()
{
	//@ts-ignore
	const btn: HTMLButtonElement = document.getElementById('btn-launch');
	btn.classList.toggle('inst-menu-item-launch');
	btn.classList.toggle('inst-menu-item-launched');
	btn.disabled = true;
	ipcRenderer.send('launchInstance', {name: inst.folder});
}

const configFileExtentions = ['cfg', 'properties', 'json', 'toml'];

async function getConfigFilesInDirectory(folder: any)
{
	let result = [];

	let files;

	try {
		files = filesystem.readdirSync(folder);
	} catch (error) 
	{
		return result;
	}

	for(let file in files)
	{
		file = files[file];
		if(configFileExtentions.includes(file.toLowerCase().split('.')[1]))
		{
			result.push(file);
		}
		
		if(!file.includes('.'))
		{
			(await getConfigFilesInDirectory(path.join(folder, file))).forEach((fileS: any) =>
			{
				result.push(file + '/' + fileS);
			});
		}
	}

	return result;
}

async function showInstalledMods(search = "")
{
	await updateModListCache();

	let elemxd: any = document.getElementById('filterMods');
	elemxd.style.display = 'block';
	let elemxd2: any = document.getElementById('searchMods');
	elemxd2.style.display = 'none';
	search = search.trim().toLowerCase();

	if(!modsList) return;

	let code = "";

	for(let modJar in modsList)
	{
		if(search != "")
		{
			if(!modJar.toLowerCase().includes(search)) continue;
		} 
		code += `<li class="list-group-item modItem"><div class="modDiv">`;
		let mod = modsList[modJar];
		if(mod == undefined) mod = modsList[modJar.toLowerCase()];

		code += `<button class="btn-delete" onclick="this.parentElement.parentElement.remove(); deleteModFromInstance('${modJar}')">Delete</button>`;
		
		if(mod.length != 0)
		{
			let actualMod = mod[0];
			if(!actualMod) actualMod = mod;

			let extra = "";
			if(actualMod.url)
			{
				extra = `onclick="openURL('${actualMod.url}')"`;
			}
			let name = actualMod.name == undefined ? modJar:actualMod.name;

			if(actualMod.info && actualMod.info.attachments)
			{
				let thumbnail = actualMod.info.attachments.filter((img: any) => img.isDefault);
				if(thumbnail.length >= 1) code += `<img class="mod-icon" src="${thumbnail[0].thumbnailUrl}"> `;
			}

			code += `<a href="#" ${extra}>${name}</a>`;

			let authors = "";
			if(actualMod.info && actualMod.info.authors)
			{
				authors += " by ";
				actualMod.info.authors.forEach(author => 
				{
					authors += `<a href="#" onclick="openURL('${author.url}')">${author.name}</a> `;
				});

				if(actualMod.name)
				{
					code += `${authors}<br><small class="mod-desc">${actualMod.info.summary}</small>`;
				}
			}
		} else
		{
			code += `<a href="#">${modJar}</a>`;
		}

		code += `<div class="mod-buttons"><span>Enabled: </span><input type="checkbox" onclick="changeModState(this.checked, '${modJar}')" ${mod.disabled ? '':'checked'}>
				</div><br>`;

		code += `</div></li>`;
	}

	injectIntoContainer
	(`
		<ul class='list-group' style="margin-top: 50px; overflow-y: auto; height: 80vh;">${code}</ul><br>
	`);
}

function changeModState(state: any, modJar: any)
{
	let fs = require('fs');

	modJar = modJar.replace('.disabled', '');
	let filePath = path.join(instanceManager.getWorkingDir(), 'instances', inst.folder, 'mods', modJar);

	console.log({path: filePath});

	if(!mods[modJar])
	{
		mods[modJar] = {};
	}

	if(state)
	{
		fs.renameSync(filePath + '.disabled', filePath);
		mods[modJar].disabled = false;
	} else
	{
		mods[modJar].disabled = true;
		fs.renameSync(filePath, filePath + '.disabled');
	}
	saveModList();
}

function openURL(url: any)
{
	shell.openItem(url);
}

async function getMods(index = 0)
{
	let elemxd: any = document.getElementById('filterMods');
	elemxd.style.display = 'none';
	let elemxd2: any = document.getElementById('searchMods');
	elemxd2.style.display = 'block';

	let searchElem: any = document.getElementById('modSearch');
	let mcVersion = inst.info.version.id;

	let searchResult = await twitchappapi.addonSearch(0, 432, mcVersion, index, 25, searchElem.value, 6, 0);
	let filteredSearchResults: any = [];

	console.log(searchResult);
	console.log(searchResult.length);
	if(searchResult.length == 0) return;

	for(let i = 0; i < searchResult.length; i++)
	{
		let current = searchResult[i];
		
		let found = false;
		for(let mod in mods)
		{
			let modXD = mods[mod];
			if(current.id == modXD.info.id)
			{
				found = true;
				break;
			}
		}
		if(found) continue;

		if(!current.gameVersionLatestFiles) continue;

		let result = current.gameVersionLatestFiles.filter((curr: any) => curr.gameVersion == mcVersion);
		if(!result) continue;

		filteredSearchResults.push(current);
	}

	let code = "";

	for(let i = 0; i < filteredSearchResults.length; i++)
	{
		let mod = filteredSearchResults[i];

		let authors = "";
		if(mod.authors)
		{
			authors += "by ";
			mod.authors.forEach(author => 
			{
				authors += `<a href="#" onclick="openURL('${author.url}')">${author.name}</a> `;
			});
		}

		code += `<li class="list-group-item modItem"><div class="modDiv">`;
		if(mod.attachments)
		{
			let thumbnail = mod.attachments.filter((img: any) => img.isDefault);
			if(thumbnail.length >= 1) code += `<img class="mod-icon" src="${thumbnail[0].thumbnailUrl}"> `;
		}
		code += `<a href="#" onclick="openURL('${mod.websiteUrl}')">${mod.name}</a> <small>${authors}</small><br><small class="mod-desc">${mod.summary}</small> <button class="btn-get" id="btn-${mod.id}" onclick="this.disabled=true; installMod(${mod.id});">Install</button>`;
		code += `</div></li>`;
	}

	if(index == 0)
	{
		injectIntoContainer
		(`
			<ul class='list-group' id="grouplist" style="margin-top: 50px; overflow-y: auto; height: 80vh;">${code}</ul><br>
		`);
	} else
	{
		document.getElementById('grouplist').innerHTML += code;
	}

	if(filteredSearchResults.length < 5)
	{
		getMods(index + 25);
	}

	let elem = document.getElementById('grouplist');
	elem.onscroll = function()
	{
		if(elem.scrollTop + 800 >= elem.scrollHeight)
		{
			console.log('load more stuff');
			elem.onscroll = null;
			getMods(index + 25);
		}
	}
}

function updateModList()
{
	let xd = require('fs');
	console.log('reading mod list');
	try {
		mods = JSON.parse(xd.readFileSync(path.join(instanceManager.getWorkingDir(), 'instances', inst.folder, 'mods.json')));
	} catch (error) 
	{
		console.log(error);
		mods = {};    
	}
}

function saveModList()
{
	let xd = require('fs');
	console.log('saving mod list');
	xd.writeFileSync(path.join(instanceManager.getWorkingDir(), 'instances', inst.folder, 'mods.json'), JSON.stringify(mods));
}

async function installMod(id: number, iteration = 0)
{
	let addonFiles = await twitchappapi.getAddonFiles(id);
	let mcVersion = inst.info.version.id;

	let forThisMcVersion = addonFiles.filter((file: any) => file.gameVersion.includes(mcVersion));

	forThisMcVersion.sort(function(a: any, b: any)
	{
		return new Date(b.fileDate).getTime() - new Date(a.fileDate).getTime();
	});

	let selectedVersion = forThisMcVersion[0];
	if(!selectedVersion)
	{
		console.log('Did not find version for mc'+mcVersion+' for mod '+id);
		console.log(addonFiles);
		return;
	}

	if(mods[selectedVersion.fileName])
	{
		console.log('Skipping downloading of ' + selectedVersion.fileName + ' because it already exists, addonID: ' + id);
		return;
	}

	let modsFolder = path.join(instanceManager.getWorkingDir(), 'instances', inst.folder, 'mods');

	downloadFile(path.join(modsFolder, selectedVersion.fileName), selectedVersion.downloadUrl).then(() => 
	{
		let elem = document.getElementById('btn-'+id);
		if(elem)
		{
			elem.style.backgroundColor = 'red';
			// @ts-ignore
			elem.disabled = false;
			elem.innerHTML = "Delete";
			elem.removeAttribute("onclick");
			elem.onclick = function()
			{
				// @ts-ignore
				elem.disabled = true;
				deleteModFromInstance(selectedVersion.fileName);
				elem.style.backgroundColor = 'black';
				elem.innerHTML = "Install";
				elem.removeAttribute('onclick');
				// @ts-ignore
				elem.disabled = false;
				elem.onclick = function()
				{
					// @ts-ignore
					document.getElementById('btn-'+id).disabled = true;
					installMod(id);
				}
			}
		}       
	});
	let info = await twitchappapi.getAddonInfo(id);
	mods[selectedVersion.fileName.trim()] = {info: info, name: info.name, url: info.websiteUrl, fileInfo: selectedVersion};
	saveModList();
	
	if(selectedVersion.dependencies && iteration < 3)
	{
		selectedVersion.dependencies.forEach(async (depend: any) => 
		{
			if(depend.type != 3) return;
			console.log('Getting dependency ' + depend.addonId + ' of ' + selectedVersion.fileName);

			installMod(depend.addonId, ++iteration);
		});
	}
}

async function downloadFile(target: any, url: any)
{
	var plS = require('fs');

	console.log('Downloading ' + url + ' to ' + target);
	const res = await fetch(url);
	return await new Promise((resolve, reject) => 
	{
		const fileStream = plS.createWriteStream(target);
		res.body.pipe(fileStream);
		res.body.on("error", (err: Error) => 
		{
			console.log('Could not download ' + url);
			reject(err);
		});
		fileStream.on("finish", function() 
		{
			console.log('Downloaded ' + url);
			resolve();
		});
	});
}

export async function resolveModList(modsFolder: string)
{
	var plS = require('fs');
	if(!plS.existsSync(modsFolder)) plS.mkdirSync(modsFolder);

	let dir: any = plS.readdirSync(modsFolder);
	let result: any = {};

	let promises = [];

	for(let y = 0; y < dir.length; y++)
	{
		let modJar: any = dir[y];

		if(modJar.endsWith('.jar') || modJar.endsWith('.jar.disabled'))
		{
			let paff: string = path.join(modsFolder, modJar);
			let cleanedFileName = modJar.replace('.jar.disabled', '.jar').trim();
			if(mods[cleanedFileName])
			{
				result[cleanedFileName] = mods[cleanedFileName];
				continue;
			} else
			{
				console.log('Not found in mods array: ' + cleanedFileName);

			}
	
			let file: Buffer = plS.readFileSync(paff);
			let metaData: Promise<Forge.MetaData[]> = Forge.meta(file);

			metaData.then((metaData: Forge.MetaData[]) =>
			{
				if(metaData.length == 0)
				{
					console.log('no metadata found for mod ' + modJar);
				}
				
				let cleanedData = [];
	
				for(let i = 0; i < metaData.length; i++)
				{
					let data = metaData[i];
	
					if(data.modid != 'examplemod') cleanedData.push(data);
				}
	
				result[modJar.trim()] = cleanedData;
			});

			promises.push(metaData);
		}
	}

	
	console.log('waiting for all to resolve');
	await Promise.all(promises);
	console.log('done');
	return result;
}