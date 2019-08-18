import { Forge } from '@xmcl/forge';
import { ForgeInstaller } from '@xmcl/forge-installer';
import { Version } from '@xmcl/version';
import { readdirSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { ChildProcess } from 'child_process';
import { Installer } from '@xmcl/installer';
import { Launcher } from '@xmcl/minecraft-launcher-core';

const electron = require('electron');

import { Store } from './store';

let store = new Store(
{
	configName: 'user-data',
	defaults: {}
});


var playing = false;

export function isPlaying()
{
	return playing;
}

export function getInstances()
{
	let result: any = {};

	const workingDir = getWorkingDir();

	if(!existsSync(join(workingDir, 'instances'))) mkdirSync(join(workingDir, 'instances'));

	let files = readdirSync(join(workingDir, 'instances'));

	files.forEach(folder =>
	{
		let instance: any = {};

		instance.folder = folder;

		let info = join(workingDir, 'instances', folder, 'info.json');
		if(existsSync(info))
		{
			let json: any = readFileSync(info);
			instance.info = JSON.parse(json);
			instance.info.name = instance.info.name.toLowerCase().replace(/[/\\?%*:|"<>]/g, "").replace(/'/g, '').replace('"', '').substring(0, 20).trim();

			result[instance.info.name] = instance;
		} else
		{
			console.warn(info + ' was not found!');
		}
	});

	return result;
}

export function getWorkingDir()
{
	return (electron.app || electron.remote.app).getPath('userData');
}

export async function createInstance(version: any, name: string, forge: any, dontMarkDone: any)
{
	const workingDir = getWorkingDir();
	const assetsDir = join(workingDir, 'sharedFiles');
	const nameLowerCase = name.toLowerCase().replace(/[/\\?%*:|"<>]/g, "").replace(/'/g, '').replace('"', '').substring(0, 20).trim();
	console.log('createInstance() name: ' + nameLowerCase);
	const instanceDir = join(workingDir, 'instances', nameLowerCase);
	const dateCreated = new Date().getTime();

	if(!existsSync(instanceDir)) mkdirSync(instanceDir);
	if(!existsSync(assetsDir)) mkdirSync(assetsDir);

	let update = function(downloading = true, customColor = undefined)
	{
		writeFileSync(join(instanceDir, 'info.json'), JSON.stringify({name: nameLowerCase, customColor: customColor, dateCreated: dateCreated, displayName: name.trim(), downloading: downloading, version: version, forge: forge}));
	}

	update(true, "rgb(0, 40, 0)");

	console.log(`[${nameLowerCase}] starting download [version jar]...`);
	await Installer.installVersion('client', version, assetsDir);
	console.log(`[${nameLowerCase}] finished download [version jar]`);
	update(true, "rgb(0, 60, 0)");
	console.log(`[${nameLowerCase}] starting download [assets]...`);
	await Installer.installAssets((await Version.parse(assetsDir, version.id)));
	console.log(`[${nameLowerCase}] finished download [assets]`);
	update(true, "rgb(0, 80, 0)");
	console.log(`[${nameLowerCase}] starting download [libraries]...`);
	await Installer.installLibraries((await Version.parse(assetsDir, version.id)));
	console.log(`[${nameLowerCase}] finished download [libraries]`);
	update(true, "rgb(0, 100, 0)");

	if(forge)
	{
		update(true, "rgb(0, 160, 0)");
		console.log(`[${nameLowerCase}] starting forge download...`);
		await ForgeInstaller.install(forge, assetsDir, {forceCheckDependencies: true});
		console.log(`[${nameLowerCase}] finished forge download...`);
		
		let files = readdirSync(join(assetsDir, 'versions'));
		let fVer;
		files.forEach(folder =>
		{
			if(folder.toLowerCase().includes('forge') && folder.toLowerCase().includes(version.id) && folder.toLowerCase().includes(forge.version))
			{
				fVer = folder;
				return;
			}
		});
		console.log(`[${nameLowerCase}] starting forge dependencies(${fVer}) download...`);
		await Installer.installDependencies((await Version.parse(assetsDir, fVer)));
		console.log(`[${nameLowerCase}] finished forge dependencies download`);
		if(dontMarkDone) update(true, "rgb(0, 255, 0)");
	}
	console.log(`[${nameLowerCase}] instance installation completed.`);
	if(!dontMarkDone) update(false);
}