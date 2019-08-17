import { Version, Auth, ForgeWebPage, MojangService, Forge, Installer } from '@xmcl/minecraft-launcher-core';
import { app, BrowserWindow, ipcMain, autoUpdater, dialog } from "electron";

import { createInstance, getWorkingDir } from './instanceManager'
import { Store } from './store';
import { join } from 'path';
import { mkdirSync, existsSync, exists, createWriteStream, unlinkSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import ForgeInstaller from '@xmcl/forge-installer';

const fetch = require('node-fetch');

var discordRichPresence;

try 
{
	discordRichPresence = require('discord-rich-presence')('601845589738520596');
} catch (error) 
{
	console.log('Could not connect to discord rich presence!');
}

// @ts-ignore
if(require('electron-squirrel-startup')) return;

if(handleSquirrelEvent()) 
{
	// @ts-ignore
	return;
}
  
function handleSquirrelEvent() 
{
	if (process.argv.length === 1) 
	{
		return false;
	}

	const ChildProcess = require('child_process');
	const path = require('path');

	const appFolder = path.resolve(process.execPath, '..');
	const rootAtomFolder = path.resolve(appFolder, '..');
	const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
	const exeName = path.basename(process.execPath);

	const spawn = function(command, args) 
	{
		let spawnedProcess, error;

		try
		{
		spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
		} catch (error) {}

		return spawnedProcess;
	};

	const spawnUpdate = function(args) 
	{
		return spawn(updateDotExe, args);
	};

	const squirrelEvent = process.argv[1];
	switch (squirrelEvent) {
		case '--squirrel-install':
		case '--squirrel-updated':
		// Optionally do things such as:
		// - Add your .exe to the PATH
		// - Write to the registry for things like file associations and
		//   explorer context menus

		// Install desktop and start menu shortcuts
		spawnUpdate(['--createShortcut', 'Soup Launcher']);

		setTimeout(app.quit, 1000);
		return true;

		case '--squirrel-uninstall':
		// Undo anything you did in the --squirrel-install and
		// --squirrel-updated handlers

		// Remove desktop and start menu shortcuts
		spawnUpdate(['--removeShortcut', 'Soup Launcher']);

		setTimeout(app.quit, 1000);
		return true;

		case '--squirrel-obsolete':
		// This is called on the outgoing version of your app before
		// we update to the new version - it's the opposite of
		// --squirrel-updated

		app.quit();
		return true;
	}	
};

const isDev = require('electron-is-dev');

if (isDev) 
{
	console.log('Running in development');
} else 
{
	console.log('Running in production');
	const server = "https://hazel.realsouper.now.sh";
	const feed: any = `${server}/update/${process.platform}/${app.getVersion()}`

	console.log(feed);
	autoUpdater.setFeedURL(feed);
	console.log('Checking for updates...');
	autoUpdater.checkForUpdates();
	setInterval(() => 
	{
		console.log('Checking for updates...');
		autoUpdater.checkForUpdates();
	}, 10 * 60 * 1000)
}

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => 
{
	const dialogOpts = 
	{
		type: 'info',
		buttons: ['Restart', 'Later'],
		title: 'Application Update',
		message: process.platform === 'win32' ? releaseNotes : releaseName,
		detail: 'A new version has been downloaded. Restart the application to apply the updates.'
	}
	//@ts-ignore
	dialog.showMessageBox(dialogOpts, (response) => 
	{
		if (response === 0) autoUpdater.quitAndInstall();
	});
});

autoUpdater.on('error', message => 
{
	console.error('There was a problem updating the application');
	console.error(message);
});

const store = new Store(
{
	configName: 'user-data',
	defaults: {}
});

let win: BrowserWindow;

async function checkVersions(forceRefresh = false)
{
	let versions = await Installer.updateVersionMeta();
	let forgeVersions: any = store.get('forgeVersions');
	if(forgeVersions === undefined) forgeVersions = {};
	store.set('versions', versions);
	console.log('Fetched minecraft versions, latest is ' + versions.latest.release);

	if(!store.get('forgeVersions') || forceRefresh)
	{
		for(let i = 0; i < versions.versions.length; i++)
		{
			let ver = versions.versions[i];
			if(ver.type != 'release') continue;

			try 
			{
				let fallback = undefined;
				if(forgeVersions[ver.id])
				{
					fallback = forgeVersions[ver.id];
				}

				let forgeVer = await ForgeWebPage.getWebPage({mcversion: ver.id, fallback: fallback});
				forgeVersions[ver.id] = forgeVer;
				console.log('Fetched forge versions for mc ' + ver.id);
			} catch (error) 
			{
				console.log('No forge versions found for mc ' + ver.id + ' ('+error.message+')');
			}
		}
		store.set('forgeVersions', forgeVersions);
	}
}

async function createWindow()
{
	win = new BrowserWindow(
		{
			width: 1000,
			height: 720,
			webPreferences: {nodeIntegration: true}
		}
	);

	win.on('close', () =>
	{
		process.exit();
	});
	
	if(!isDev)
	{
		win.setMenu(null);
	}

	if(!store.get('memory'))
	{
		store.set('memory', {minMemory: 1024, maxMemory: 2048});
	}

	if(!store.get('playing'))
	{
		store.set('playing', {playing: false});
	}

	if(!store.get('javaArgs'))
	{
		store.set('javaArgs', '-XX:+UseG1GC -Dsun.rmi.dgc.server.gcInterval=2147483646 -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M');
	}

	if(!store.get('profile'))
	{
		win.loadURL(`file://${__dirname}/../src/frontend/login.html`);
		return;
	}

	try 
	{
		if(!store.get('playing').playing)
		{
			console.log('Refreshing login...');
			const info = await Auth.Yggdrasil.refresh(store.get('profile'));
			store.set('profile', info);
		} else
		{
			console.log('Instance is already running so not refreshing login token but will refresh on next launch.');
			store.set('playing', {playing: false});
		}
	} catch (error) 
	{
		console.log('accessToken invalid! Login again.');
		store.set('profile', undefined); 
		win.loadURL(`file://${__dirname}/../src/frontend/login.html?flash=${encodeURI('Login expired! <br> Login again.')}`);
		return;
	}

	win.loadURL(`file://${__dirname}/../src/frontend/index.html`);
	
	checkVersions(true);
}

ipcMain.on('submitForm', async (event: any, data: any) =>
{
	const username: string = data.email;
	const password: string =  data.password;

	try 
	{
		console.log('Sending login request....');
		const auth = await Auth.Yggdrasil.login({username, password});
		console.log('Got response!');

		store.set('profile', auth);
		await checkVersions();
		win.loadURL(`file://${__dirname}/../src/frontend/index.html`);
	} catch (error) 
	{
		console.log(error);
		win.loadURL(`file://${__dirname}/../src/frontend/login.html?flash=Incorrect+password!`);
	}
});

ipcMain.on('newInstance', async (event: any, data: any) =>
{
	const version: any = data.version;
	const name: string = data.name;
	const forgeVersion: any = data.forgeVersion;
	const dontMarkDone: any = data.dontMarkDone;
	
	console.log(`Creating a new instance with minecraft version ${version.id} and name "${name}"`);
	if(forgeVersion) console.log('With forge support.');

	await createInstance(version, name, forgeVersion, dontMarkDone);
});

ipcMain.on('refreshVersions', async (event: any, data: any) =>
{
	store.set('forgeVersions', undefined);
	checkVersions();
});

function updatePresence(state: string, details: string)
{
	try 
	{
		discordRichPresence.updatePresence(
		{
			state: state,
			details: details,
			startTimestamp: Date.now(),
			largeImageKey: 'logo',
			smallImageKey: 'logo',
			instance: true,
		});
	} catch (error)
	{
		console.log('Failed to update discord rich presence!');
	}
}

ipcMain.on('setDiscordRichPresence', async (event: any, data: any) =>
{
	updatePresence(data.state, data.details);
});

ipcMain.on('launchInstance', async (event: any, data: any) =>
{
	win.webContents.send('launchInstance', data);
});

ipcMain.on('stoppedPlaying', async (event: any, data: any) =>
{
	console.log('stopped playing ' + data.instance.folder);
	win.webContents.send('stoppedPlaying', data);
});

ipcMain.on('installModPack', async (event: any, data: any) =>
{
	console.log('got msg to install modpack, downloading zip '+data.zipUrl+'...');
	let sharedFiles = join(getWorkingDir(), 'sharedFiles');
	let modpackZips = join(sharedFiles, 'modpackZips');

	if(!existsSync(sharedFiles))
	{
		mkdirSync(sharedFiles);
	}
	
	if(!existsSync(modpackZips))
	{
		mkdirSync(modpackZips);
	}
	
	let fileName = data.zipUrl.split('/');
	fileName = fileName[fileName.length - 1];
	let file = join(modpackZips, fileName);
	data.zipFile = file;
	
	console.log('saving under: ' + fileName);

	if(!existsSync(file))
	{
		console.log('was not found, downloading!');
		await downloadFile(file, data.zipUrl);
		console.log('Downloaded ' + fileName);
	}
	
	win.webContents.send('installPackDL', data);
});

ipcMain.on('changeInstance', async (event: any, data: any) => 
{
	let instanceRoot = join(getWorkingDir(), 'instances', data.instanceFolder);
	// @ts-ignore
	let info = JSON.parse(readFileSync(join(instanceRoot, 'info.json')));
	let versions = join(getWorkingDir(), 'sharedFiles', 'versions');
	let assetsDir = join(getWorkingDir(), 'sharedFiles');
	let files = readdirSync(versions);

	let update = function(downloading = true, customColor = undefined)
	{
		info.downloading = downloading;
		info.customColor = customColor;
		writeFileSync(join(instanceRoot, 'info.json'), JSON.stringify(info));
	}

	if(data.changed.version)
	{
		let versionFound;
		files.forEach(folder =>
		{
			if(folder == data.changed.version.id)
			{
				versionFound = true;
				return;
			}
		});

		if(!versionFound)
		{
			console.log('Version not found, downloading mc ' + data.changed.version.id);
			update(true, "rgb(0, 40, 0)");

			console.log(`[${data.instanceFolder}] starting download [version jar]...`);
			await Installer.installVersion('client', data.changed.version, assetsDir);
			console.log(`[${data.instanceFolder}] finished download [version jar]`);
			update(true, "rgb(0, 60, 0)");
			console.log(`[${data.instanceFolder}] starting download [assets]...`);
			await Installer.installAssets((await Version.parse(assetsDir, data.changed.version.id)));
			console.log(`[${data.instanceFolder}] finished download [assets]`);
			update(true, "rgb(0, 80, 0)");
			console.log(`[${data.instanceFolder}] starting download [libraries]...`);
			await Installer.installLibraries((await Version.parse(assetsDir, data.changed.version.id)));
			console.log(`[${data.instanceFolder}] finished download [libraries]`);
		}

		info.version = data.changed.version;
	}

	if(data.changed.forge === undefined)
	{
		info.forge = undefined;
	}

	if(data.changed.forge)
	{
		let versionFound;
		files.forEach(folder =>
		{
			if(folder.toLowerCase().includes('forge') && folder.toLowerCase().includes(info.version.id) && folder.toLowerCase().includes(data.changed.forge.version))
			{
				versionFound = true;
				return;
			}
		});
	
		if(!versionFound)
		{
			console.log('Forge version not found, installing ' + data.changed.forge.version);
			update(true, "rgb(0, 160, 0)");
			console.log(`[${data.instanceFolder}] starting forge download...`);
			await ForgeInstaller.install(data.changed.forge, assetsDir, {forceCheckDependencies: true});
			console.log(`[${data.instanceFolder}] finished forge download`);
		}

		info.forge = data.changed.forge;
	}

	update(false);
});

async function downloadFile(target: any, url: any)
{
	console.log('Downloading ' + url + ' to ' + target);
	const res = await fetch(url);
	return await new Promise((resolve, reject) => 
	{
		const fileStream = createWriteStream(target);
		res.body.pipe(fileStream);
		res.body.on("error", (err: Error) => 
		{
			console.log('Could not download ' + url);
			if(existsSync(target)) unlinkSync(target);
			reject(err);
		});
		fileStream.on("finish", function() 
		{
			console.log('Downloaded ' + url);
			resolve();
		});
	});
}

updatePresence('Lurking', 'Idle');

app.on('ready', createWindow);
