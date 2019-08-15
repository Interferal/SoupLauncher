let Store = require('../../dest/store.js').Store;
let instanceManager = require('../../dest/instanceManager.js');
let ipcRenderer = require('electron').ipcRenderer;

import { readdirSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

let instances = instanceManager.getInstances();
var $_GET = {};
if(document.location.toString().indexOf('?') !== -1) 
{
    var query = document.location.toString().replace(/^.*?\?/, '').replace(/#.*$/, '').split('&');

	for(var i=0, l=query.length; i<l; i++) 
	{
        var aux = decodeURIComponent(query[i]).split('=');
        $_GET[aux[0]] = aux[1].replace('+', ' ');
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


function injectIntoContainer(data: string)
{
	let elem: any = document.getElementById('container');
	while (elem.firstChild) elem.removeChild(elem.firstChild);
	elem.innerHTML = data;
}

async function showJavaSettings()
{
    injectIntoContainer
    (
        ``
    );
}

async function showVersionSettings()
{

}