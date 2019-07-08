const path = require('path');
const twitchappapi = require('twitchappapi');
const instanceManager = require('../../dest/instanceManager.js');
const fetch = require('node-fetch');

import { Forge } from 'ts-minecraft';
import { shell } from 'electron';

let instances = instanceManager.getInstances();
var $_GET: any = {};
if(document.location.toString().indexOf('?') !== -1) {
    var query = document.location.toString().replace(/^.*?\?/, '').replace(/#.*$/, '').split('&');

    for(var i=0, l=query.length; i<l; i++) {
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

let doc: any = document.getElementById('title');
doc.innerHTML += inst.info.displayName;

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

    let fs = require('fs');
    fs.unlinkSync(path.join(instanceManager.getWorkingDir(), 'instances', inst.folder, 'mods', modProfile.disabled ? modJar+'.disabled':modJar));
    delete mods[modJar];
    saveModList();
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
        console.log({mod: mod});

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
            code += `<a href="#" ${extra}>${name}</a>`;
            if(actualMod.name)
            {
                code += `<br><small class="mod-desc">${actualMod.info.summary}</small>`;
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
                authors += `<a href="#" onclick="openURL('${author.url}')">${author.name}</a>`;
            });
        }

        code += `<li class="list-group-item modItem"><div class="modDiv">`;
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

async function installMod(id: number, skipDependencyCheck = false)
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
    mods[selectedVersion.fileName.toLowerCase().trim()] = {info: info, name: info.name, url: info.websiteUrl, fileInfo: selectedVersion};
    saveModList();
    
    if(selectedVersion.dependencies && !skipDependencyCheck)
    {
        selectedVersion.dependencies.forEach(async (depend: any) => 
        {
            if(depend.type != 3) return;
            console.log('Getting dependency ' + depend.addonId + ' of ' + selectedVersion.fileName);
            console.log(depend);
            installMod(depend.addonId, true);
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
            let file: Buffer = plS.readFileSync(paff);

            let cleanedFileName = modJar.replace('.jar.disabled', '.jar').toLowerCase().trim();
            if(mods[cleanedFileName])
            {
                result[cleanedFileName] = mods[cleanedFileName];
                continue;
            }
    
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
    
                result[modJar.toLowerCase().trim()] = cleanedData;
            });

            promises.push(metaData);
        }
    }

    
    console.log('waiting for all to resolve');
    await Promise.all(promises);
    console.log('done');
    return result;
}