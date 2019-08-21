let Store = require('../../dest/store.js').Store;
let instanceManager = require('../../dest/instanceManager.js');
let ipcRenderer = require('electron').ipcRenderer;

import { readdirSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

let store = new Store(
{
    configName: 'user-data',
    defaults: {}
});

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
console.log('instName: ' + instName);

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

function injectIntoContainer(data: string)
{
	let elem: any = document.getElementById('container');
	while (elem.firstChild) elem.removeChild(elem.firstChild);
	elem.innerHTML = data;
}

let versions = store.get('versions');
let forgeVersions = store.get('forgeVersions');

async function showVersionSettings()
{
    injectIntoContainer
    (`
        <div class="versionbox">
            <form class="versionbox" onsubmit="newInstance()">
                <div class="form-group">
                    <label for="version">Version</label>
                    <select required class="form-control" id="version" onchange="changedVersion(JSON.parse(this.value))">
                        <option value="">--Please choose a version--</option>
                    </select>
                </div>

                <div class="form-group" id="forgeVersionSelector" style="display: none;">
                    <label for="forgeversion">Forge Version</label>
                    <select class="form-control" id="forgeversion">
                    </select>
                </div>
                <br>
                <button type="submit" onclick="saveNewVersion(this)" class="btn btn-primary" style="margin-left: 10px;" id="submit">Save</button>
            </form>
        </div>
    `);

    let select = document.getElementById('version');

    let preselected;

    for(let i = 0; i < versions.versions.length; i++)
    {
        let ver = versions.versions[i];

        var opt = document.createElement('option');
        opt.value = JSON.stringify(ver);
        opt.innerHTML = ver.type + " " + ver.id;
        if(inst.info.version.id == ver.id)
        {
            console.log('verid was same');
            opt.selected = true;
            preselected = ver;
        }
        select.appendChild(opt);
    }

    if(preselected) changedVersion(preselected);
}

function saveNewVersion(btn)
{
    btn.disabled = true;

    //@ts-ignore
    let newVersion = JSON.parse(document.getElementById('version').value);
    let newForgeVersion;
    let forgeVersionElement = document.getElementById('forgeversion');


    if(document.getElementById('forgeVersionSelector').style.display != 'none')
    {
        //@ts-ignore
        if(forgeVersionElement.value)
        {
            //@ts-ignore
            newForgeVersion = JSON.parse(forgeVersionElement.value);   
        }
    }

    let changed = {version: undefined, forge: undefined};

    if(newVersion.id != inst.info.version.id)
    {
        console.log('Changed mcVersion from ' + inst.info.version.id + ' to ' + newVersion.id);
        changed.version = newVersion;
    }
    
    let oldForgeVersion = inst.info.forge;
    if(oldForgeVersion) oldForgeVersion = oldForgeVersion.version;
    if(oldForgeVersion === "") oldForgeVersion = undefined;

    let newForgeVersionId = newForgeVersion;
    if(newForgeVersionId) newForgeVersionId = newForgeVersionId.version;

    if(oldForgeVersion != newForgeVersionId)
    {
        console.log('Forge version changed from ' + oldForgeVersion + ' to ' + newForgeVersion);
        changed.forge = newForgeVersion;
    }

    ipcRenderer.send('changeInstance', {changed: changed, instanceFolder: inst.folder});

    window.close();
}

function changedVersion(version)
{
    let versionsForMc = forgeVersions[version.id];

    let elem = document.getElementById('forgeVersionSelector');
    elem.style.display = versionsForMc ? 'block':'none';
    let selector = document.getElementById('forgeversion');
    while (selector.firstChild) 
    {
        selector.removeChild(selector.firstChild);
    }

    if(versionsForMc)
    {
        let noForge = document.createElement('option');
        noForge.value = "";
        noForge.innerHTML = "-- No forge --";
        selector.appendChild(noForge);

        for(let i = 0; i < versionsForMc.versions.length; i++)
        {
            let v = versionsForMc.versions[i];
            let opt = document.createElement('option');
            opt.value = JSON.stringify(v);
            opt.innerHTML = v.version + " " + v.date;
            if(inst.info.forge)
            {
                if(inst.info.forge.version == v.version) opt.selected = true;
            }
            selector.appendChild(opt);
        }
    }
}

async function showJavaSettings()
{
    injectIntoContainer
    (
        ``
    );
}
