const shell = require('electron').shell;
const path = require('path');
const twitchappapi = require('twitchappapi');
let ipcRenderer = require('electron').ipcRenderer;

let Store = require('../../dest/store.js').Store;
let instanceManager = require('../../dest/instanceManager.js');

const store = new Store(
{
    configName: 'user-data',
    defaults: {}
});

function openURL(url)
{
    shell.openItem(url);
}

let typingTimer;
let doneTypingInterval = 1000;
let myInput = document.getElementById('searchpack');

myInput.addEventListener('keyup', () => 
{
    console.log('keyup xd');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(loadMore, doneTypingInterval);
});

async function loadMcVersions()
{
    let versions = store.get('versions');
    let selectElement = document.getElementById('gameVersion');

    for(let i = 0; i < versions.versions.length; i++)
    {
        let ver = versions.versions[i];
        if(ver.type != 'release') continue;

        let child = document.createElement('option');
        child.setAttribute('value', ver.id);
        child.innerHTML = ver.id;

        selectElement.appendChild(child);
    }
}

async function loadMore(index = 0)
{
    console.log('Load more @' + index);
    let searchString = document.getElementById('searchpack').value.trim();
    let gameVersion = document.getElementById('gameVersion').value.trim();
    let sortBy = parseInt(document.getElementById('sortBy').value.trim());

    let searchResult = await twitchappapi.addonSearch(0, 432, gameVersion, index, 25, searchString, 4471, sortBy);
    let htmlData = '';

    if(index == 0)
    {
        window.scrollTo(0, 0);
        htmlData = `<ul class='list-group' id="modPacksUl"><br>`;
    }

    for (let modPackIndex = 0; modPackIndex < searchResult.length; modPackIndex++) 
    {
        const modPack = searchResult[modPackIndex];

        htmlData += `<li class="list-group-item modItem"><div class="modDiv">`;
        htmlData += `<button onclick="openInstallDialog(${modPack.id})" class="btn-installModpack">Install</button>`;
        
        let thumbnail = modPack.attachments.filter(img => img.isDefault);
        if(thumbnail.length >= 1) htmlData += `<img class="mod-icon" src="${thumbnail[0].thumbnailUrl}"> `;
        htmlData += `<a href="#" class="modpackbrowser-name" onclick="openURL('${modPack.websiteUrl}');">${modPack.name}</a>`;

        let authors = "";
        if(modPack.authors)
        {
            authors += " by ";
            modPack.authors.forEach(author => 
            {
                authors += `<a href="#" onclick="openURL('${author.url}')">${author.name}</a> `;
            });

            htmlData += `${authors}<br><small class="mod-desc">${modPack.summary}</small>`;
        }
        
        htmlData += '</div></li>';
    }
    

    if(index == 0)
    {
        htmlData += "</ul>";
        injectIntoContainer(htmlData);
    } else
    {
        document.getElementById('modPacksUl').innerHTML += htmlData;
    }

    $(window).scroll(function() 
    {
        if($(window).scrollTop() >= ($(document).height() - $(window).height() - 300))
        {
            $(window).unbind();
            loadMore(index + 25);
        }
    });
}

function injectIntoContainer(data)
{
    let elem = document.getElementById('modpacks');
    while (elem.firstChild) elem.removeChild(elem.firstChild);
    elem.innerHTML = data;
}

async function install(elem)
{
    let name = document.getElementById('instanceName').value.trim();
    let zipUrl = document.getElementById('modPackVersion').value;

    if(!name || name.length < 2 || name.length > 20) return alert('Name is too long or too small.');

    elem.parentElement.remove();
    document.getElementById('modpackbrowserbg').remove();

    ipcRenderer.send('installModPack', {name: name, zipUrl: zipUrl});
}

function fixEnter(e)
{
    if(e.keyCode == 13)
    {
        e.preventDefault();
        document.getElementById('okButton').click();
    }
}

async function openInstallDialog(id)
{
    let bawdy = document.getElementsByTagName('body')[0];
    bawdy.innerHTML += `<div id="modpackbrowserbg" class="modpackbrowser-bg"></div>`;
    let addonFiles = await twitchappapi.getAddonFiles(id);

    addonFiles = addonFiles.sort(function(a, b) 
    {
        a = new Date(a.fileDate);
        b = new Date(b.fileDate);
        return a>b ? -1 : a<b ? 1 : 0;
    });

    bawdy.innerHTML += `<div class="prompt modpackbrowser-prompt" data-icon="false">
                        <img class="icon" src="">
                        <h3 class="url"></h3>
                        <span class="title">Enter new instance name</span>
                        <form onsubmit="install();" onkeydown="fixEnter(event);">
                            <input tabindex="1" id="instanceName" class="title-margin" value="">
                            <span class="title" style="margin-right: 20px;">Select Modpack version</span>
                            <select id="modPackVersion" class="modPackVersion title-margin form-control" style="width: 200px;">
                                <option id="modPackVersionLatest" value=''>Latest</option>    
                            </select>
                        </form>
                        <div class="divider"></div>
                        <button id="okButton" class="ok" tabindex="2" onclick="install(this);">Install</button>
                        <button class="cancel" tabindex="3" onclick="this.parentElement.remove();document.getElementById('modpackbrowserbg').remove();">Cancel</button></div>`;


    let selectElement = document.getElementById('modPackVersion');

    for(let i = 0; i < addonFiles.length; i++)
    {
        let ver = addonFiles[i];

        let child = document.createElement('option');
        child.setAttribute('value', ver.downloadUrl);
        let releaseLetter = '';
        switch(ver.releaseType)
        {
            case 1:
            {
                releaseLetter = 'R';
                break;
            }
            case 2:
            {
                releaseLetter = 'B';
                break;
            }
            case 3:
            {
                releaseLetter = 'A';
                break;
            }
        }
        child.innerHTML = `[${releaseLetter}] ${ver.displayName}`;

        selectElement.appendChild(child);
    }

    document.getElementById('modPackVersionLatest').value = addonFiles[0].downloadUrl;
}

loadMcVersions();
loadMore();