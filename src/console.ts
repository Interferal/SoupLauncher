let Store = require('../../dest/store.js').Store;
let instanceManager = require('../../dest/instanceManager.js');
let ipcRenderer = require('electron').ipcRenderer;

import { Forge } from '@xmcl/forge';
import { ForgeInstaller } from '@xmcl/forge-installer';
import { Version } from '@xmcl/version';
import { readdirSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { ChildProcess } from 'child_process';
import { Installer } from '@xmcl/installer';
import { Launcher } from '@xmcl/minecraft-launcher-core';

let instances = instanceManager.getInstances();
var $_GET = {};
if(document.location.toString().indexOf('?') !== -1) 
{
    var query = document.location.toString().replace(/^.*?\?/, '').replace(/#.*$/, '').split('&');

	for(var i=0, l=query.length; i<l; i++) 
	{
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

let doc = document.getElementById('title');
doc.innerHTML += inst.info.displayName;

let store;

store = new Store(
{
    configName: 'user-data',
    defaults: {}
});

let proc: ChildProcess;
launchInstance(inst, store.get('profile'));

function killMc(button: HTMLButtonElement)
{
	if(confirm('Do you really want to kill the Minecraft process? Doing so may lead to data corruption!'))
	{
		proc.kill('SIGTERM');
		button.disabled = true;
	}
}

async function launchInstance(instance: any, auth: any)
{
	let version: any = instance.info.version.id;
    let playing = store.get('playing').playing;
	if(playing) return;
	let resourcePath = join(instanceManager.getWorkingDir(), 'sharedFiles');
	const gamePath: string = join(instanceManager.getWorkingDir(), 'instances', instance.folder);
	if(instance.info.forge)
	{
		let files = readdirSync(join(resourcePath, 'versions'));

		files.forEach(folder =>
		{
			if(folder.toLowerCase().includes('forge') && folder.toLowerCase().includes(version) && folder.toLowerCase().includes(instance.info.forge.version))
			{
				version = folder;
				return;
			}
		});

		if(version == instance.info.version.id)
		{
			console.log('forge was not found, downloading.');
			console.log(`[${instance.folder}] starting forge download...`);
			await ForgeInstaller.install(instance.info.forge, resourcePath, {forceCheckDependencies: true});
			console.log(`[${instance.folder}] finished forge download`);

			files.forEach(folder =>
			{
				if(folder.toLowerCase().includes('forge') && folder.toLowerCase().includes(version) && folder.toLowerCase().includes(instance.info.forge.version))
				{
					version = folder;
					return;
				}
			});

			console.log('launching: ' + version);
		}

		console.log('diagnose: ');
		console.log('checkin dependencies');
		await Installer.installDependencies((await Version.parse(resourcePath, version)));
	}

    const javaPath: string = "java";
	console.log('Launching instance ' + instance.info.displayName + ", v" + version);

	let memory = store.get('memory');
	let javaArgs = store.get('javaArgs').split(' ');

	try 
	{
		if(!store.get('javaArgs'))
		{
			console.log('java args were empty!');
			
			javaArgs = undefined;
		}
		console.log('Launching with Java args ' + javaArgs);
		proc = await Launcher.launch({extraExecOption: {detached: true, cwd: gamePath} ,version: version, gamePath: gamePath, resourcePath: resourcePath, javaPath: javaPath, auth: auth, launcherBrand: "SoupLauncher", launcherName: "soup", minMemory: memory.minMemory, maxMemory: memory.maxMemory, extraJVMArgs: javaArgs});
		proc.unref();
	} catch (error) 
	{
		console.log(error);
		return;
	}

	playing = true;
	store.set('playing', {playing: playing});
	
	ipcRenderer.send('setDiscordRichPresence', {state: instance.info.displayName, details: 'Playing'});
	
	proc.stdout.on("data", (chunk: any) => 
	{
		const content = chunk.toString();
		document.getElementById('console').innerHTML += content.replace('%tEx', '').replace(auth.accessToken, '').trim() + "<br>";
		scrollToBottom();
	});

	proc.stderr.on("data", (chunk: any) => 
	{
		const content = chunk.toString();
		document.getElementById('console').innerHTML += "<b class='console-error'>" + content.replace('%tEx', '').replace(auth.accessToken, '').trim() + "</b><br>";
		scrollToBottom();
	});

	proc.on("exit", (code: any, signal: any) => 
	{
		console.log('Instance shut down!');
		playing = false;
		store.set('playing', {playing: playing});

		ipcRenderer.send('setDiscordRichPresence', {state: "Stopped playing " + instance.info.displayName, details: "Idle"});
		ipcRenderer.send('stoppedPlaying', {instance: instance});
		if(code == 0) window.close();
	});
}
function scrollToBottom()
{
	var scrollingElement = (document.scrollingElement || document.body);
	scrollingElement.scrollTop = scrollingElement.scrollHeight;
}

scrollToBottom();

window.onbeforeunload = (e) => 
{
	e.returnValue = false;
};