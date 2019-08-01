import { VersionMeta, VersionMetaList, Version, MinecraftLocation, Launcher, Auth, MojangService, ForgeWebPage, Forge, MinecraftFolder  } from 'ts-minecraft';
import { readdirSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

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

	writeFileSync(join(instanceDir, 'info.json'), JSON.stringify({name: nameLowerCase, dateCreated: dateCreated, displayName: name.trim(), downloading: true, version: version, forge: forge}));

	console.log(`[${nameLowerCase}] starting download [version jar]...`);
	await Version.installVersion('client', version, assetsDir);
	console.log(`[${nameLowerCase}] finished download [version jar]`);
	console.log(`[${nameLowerCase}] starting download [assets]...`);
	await Version.installAssets((await Version.parse(assetsDir, version.id)), assetsDir);
	console.log(`[${nameLowerCase}] finished download [assets]`);	
	console.log(`[${nameLowerCase}] starting download [libraries]...`);
	await Version.installLibraries((await Version.parse(assetsDir, version.id)), assetsDir);
	console.log(`[${nameLowerCase}] finished download [libraries]`);

	if(forge)
	{
		console.log(`[${nameLowerCase}] starting forge download...`);
		await Forge.install(forge, assetsDir, {forceCheckDependencies: true});
		console.log(`[${nameLowerCase}] finished forge download`);
	}
	console.log(`[${nameLowerCase}] instance installation completed.`);
	if(!dontMarkDone) writeFileSync(join(instanceDir, 'info.json'), JSON.stringify({name: nameLowerCase, dateCreated: dateCreated, displayName: name.trim(), downloading: false, version: version, forge: forge}));
}