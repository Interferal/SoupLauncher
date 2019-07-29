import { Version, Auth, ForgeWebPage, MojangService } from 'ts-minecraft';
import { app, BrowserWindow, ipcMain, autoUpdater, dialog } from "electron";

import { createInstance } from './instanceManager'

import { Store } from './store';

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

async function checkVersions()
{
	let versions = await Version.updateVersionMeta();
	let forgeVersions: any = {};
	store.set('versions', versions);
	console.log('Fetched minecraft versions, latest is ' + versions.latest.release);

	if(!store.get('forgeVersions'))
	{
		for(let i = 0; i < versions.versions.length; i++)
		{
			let ver = versions.versions[i];
			if(ver.type != 'release') continue;

			try 
			{
				let forgeVer = await ForgeWebPage.getWebPage({mcversion: ver.id, fallback: forgeVersions[ver.id]});
				forgeVersions[ver.id] = forgeVer;
				console.log('Fetched forge versions for mc ' + ver.id);
			} catch (error) 
			{
				console.log('No forge versions found for mc ' + ver.id);
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
	
	//win.setMenu(null);

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
	
	checkVersions();
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
		win.loadURL(`file://${__dirname}/../src/frontend/index.html`);
		checkVersions();
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
updatePresence('Lurking', 'Idle');

app.on('ready', createWindow);
