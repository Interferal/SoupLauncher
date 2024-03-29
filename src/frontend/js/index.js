console.log('%cStop! Only use this if you know what you are doing!', 'color: red; font-size: 25px; font-weight: bold;');
console.log('%cIf someone told you to paste something in here, do not do it!', 'color: red; font-size: 20px; font-weight: bold;');

const timeout = ms => new Promise(res => setTimeout(res, ms));
const fs = require('fs-extra');
const join = require('path').join;
const {shell} = require('electron');
const remote = require('electron').remote;
const twitchappapi = require('twitchappapi');
const fetch = require('node-fetch');
const Dialogs = require('dialogs');
const dialogs = Dialogs();

let Store = require('../../dest/store.js').Store;
let instanceManager = require('../../dest/instanceManager.js');
let ipcRenderer = require('electron').ipcRenderer;

var cursorX;
var cursorY;

document.addEventListener('keydown', (e) =>
{
    if (e.which === 123)
    {
        remote.getCurrentWindow().toggleDevTools();
    } else if (e.which === 116)
    {
        location.reload();
    }
});

document.addEventListener('click', e =>
{
    let menu = document.getElementById('rc-menu-bawdy');
    let menuinstance = document.getElementById('rc-menu-instance');
    if (menuinstance)
    {
        menuinstance.remove();
        e.stopPropagation();
    }
    if (menu.style.display === 'block')
    {
        menu.style.display = 'none';
        e.stopPropagation();
    }
}, true);

document.querySelector('body').addEventListener('contextmenu', e =>
{
    let menubawdy = document.getElementById('rc-menu-bawdy');
    let menuinstance = document.getElementById('rc-menu-instance');
    if (menuinstance) menuinstance.remove();
    if (e.path[0].nodeName === 'BODY' || e.path[0].nodeName === 'DIV')
    {
        menubawdy.style.display = 'block';
        menubawdy.style.left = Math.min(cursorX, window.innerWidth - menubawdy.clientWidth) + 'px';
        menubawdy.style.top = Math.min(cursorY, window.innerHeight - menubawdy.clientHeight - document.querySelector('footer').clientHeight) + 'px';
        e.stopPropagation();
    } else if (e.path[0].nodeName === 'A')
    {
        menubawdy.style.display = 'none';
    } else if (menubawdy.style.display === 'block')
    {
        menubawdy.style.display = 'none';
        e.stopPropagation();
    }

}, true);

function browseModPacks()
{
    let win = new remote.BrowserWindow(
        {
            width: 900,
            height: 600,
            webPreferences: {nodeIntegration: true}
        }
    );
    win.loadURL(`file://${__dirname}/cursemodpackbrowser.html`);
}


function refreshVersions()
{
    ipcRenderer.send('refreshVersions', {});
}

function openUserMenu()
{
    document.getElementById('navbar').innerHTML += `
    <div onmouseleave="this.remove()" class="rc-menu" style="position: absolute; left: ${cursorX - 140}px; top: ${cursorY - 10}px; z-index: 2;">
        <a href="#" class="rc-menu-item" onclick="window.open('settings.html', '_blank', 'nodeIntegration=yes');this.parentElement.remove();">Settings</a>
        <a href="#" class="rc-menu-item" onclick="refreshVersions();this.parentElement.remove();">Refresh Versions</a>
        <a href="#" class="rc-menu-item" onclick="this.parentElement.remove();importPack();">Import Pack</a>
        <a href="#" class="rc-menu-item" onclick="logout();this.parentElement.remove();">Logout</a>
        <a href="#" class="rc-menu-item" onclick="window.open('about.html', '_blank', 'nodeIntegration=yes');this.parentElement.remove();">About</a>
        <a href="#" class="rc-menu-item inst-menu-item-launched" onclick="remote.getCurrentWindow().openDevTools();this.parentElement.remove();">Open DevTools</a>
    </div>`;
}

function logout()
{
    store.set('profile', undefined);
    remote.getCurrentWindow().loadURL(`file://${__dirname}/login.html?flash=${encodeURI('Logged out successfully!<br> Login again.')}`);
}

async function downloadFile(target, url, attempt = 0)
{
    console.log('Downloading ' + url + ' to ' + target);
    const res = await fetch(url);
    return await new Promise((resolve, reject) =>
    {
        const fileStream = fs.createWriteStream(target);
        res.body.pipe(fileStream);
        res.body.on('error', (err) =>
        {
            attempt++;
            console.log('Could not download ' + url);
            if (attempt < 4)
            {
                console.error('Failed to download ' + url + 'trying again, attempt #' + attempt);
                return downloadFile(target, url, attempt);
            }
            reject(err);
        });
        fileStream.on('finish', function ()
        {
            console.log('Downloaded ' + url);
            resolve();
        });
    });
}

async function longCatToggle()
{
    let elem = document.getElementById('longcat').style;
    if (elem.display === 'none')
    {
        elem.display = 'block';
    } else elem.display = 'none';
}

document.onmousemove = function (e)
{
    cursorX = e.pageX;
    cursorY = e.pageY;
};

let store = new Store(
    {
        configName: 'user-data',
        defaults: {}
    });

let profile = store.get('profile');
let username;
try
{
    username = profile.profiles[0].name;
} catch (error)
{
    username = profile.selectedProfile.name;
}

document.getElementById('profpic').src = 'https://minotar.net/avatar/' + username + '/48.png';

loadInstances();

const updateInterval = setInterval(loadInstances, 2000);
const {dialog} = require('electron').remote;
var AdmZip = require('adm-zip');

ipcRenderer.on('installPackDL', async (event, data) =>
{
    importPack([data.zipFile], data.name);
});

async function importPack(zipFile = undefined, mmcPackName = undefined)
{
    if (!zipFile) zipFile = await dialog.showOpenDialog(
        {
            title: 'Select Curse/MultiMC Modpack ZIP',
            properties: ['openFile'],
            filters: [{name: 'Zip Files', extensions: ['zip']}]
        });
    if (zipFile.canceled) return;
    if (zipFile.filePaths)
    {
        zipFile = zipFile.filePaths;
    }
    zipFile = zipFile[0];

    try
    {
        let zip = new AdmZip(zipFile);
        let zipEntries = zip.getEntries();
        let manifest = undefined;
        let mmcPack = undefined;

        for (let i = 0; i < zipEntries.length; i++)
        {
            const zipEntry = zipEntries[i];
            if (zipEntry.entryName.toLowerCase().trim() == 'manifest.json')
            {
                manifest = JSON.parse(zipEntry.getData().toString('utf8'));
            }

            if (zipEntry.entryName.toLowerCase().trim().includes('mmc-pack.json'))
            {
                mmcPack = JSON.parse(zipEntry.getData().toString('utf8'));
                mmcPackName = zipEntry.entryName.trim().replace('/', '').replace('mmc-pack.json', '');
            }
        }

        if (!manifest && !mmcPack)
        {
            throw new Error('Did not find manifest.json or mmc-pack.json in the zip file!');
        }

        if (!manifest && mmcPack)
        {
            manifest =
                {
                    name: mmcPackName,
                    overrides: '.minecraft',
                    mmcPack: true,
                    files: []
                };

            let mcVersion = mmcPack.components.filter(obj => obj.cachedName == 'Minecraft')[0];
            let forge = mmcPack.components.filter(obj => obj.cachedName == 'Forge')[0];

            manifest.minecraft = {version: mcVersion.version};
            manifest.minecraft.modLoaders = [];
            if (forge)
            {
                manifest.minecraft.modLoaders.push({id: 'forge-' + forge.version});
            }
        }

        if (!manifest.minecraft) throw new Error('Manifest.json did not have minecraft object.');

        let mcVersion = store.get('versions').versions.filter(version => version.id == manifest.minecraft.version)[0];
        let forgeVersion = undefined;

        let loaderList = manifest.minecraft.modLoaders || manifest.minecraft.modloaders;
        if (loaderList.length)
        {
            let forgeVersionNeeded = loaderList[0].id.split('-')[1].trim();
            forgeVersion = store.get('forgeVersions')[mcVersion.id].versions.filter(forge => forge.version == forgeVersionNeeded)[0];
        }

        console.log({mcVersion: mcVersion, forgeVersion: forgeVersion});

        if (mmcPackName)
        {
            manifest.name = mmcPackName;
        }

        let name = manifest.name.toLowerCase().replace(/[/\\?%*:|"<>]/g, '').replace(/'/g, '').replace('"', '').substring(0, 20).trim();
        let instances = instanceManager.getInstances();

        for (var inst in instances)
        {
            inst = instances[inst];
            if (inst.folder == name)
            {
                alert('Instance with the folder name ' + name + ' already exists!');
                return;
            }
        }

        ipcRenderer.send('newInstance',
            {
                name: manifest.name.trim().substring(0, 20),
                version: mcVersion,
                forgeVersion: forgeVersion,
                dontMarkDone: true
            });
        await timeout(1000);
        let instDir = join(instanceManager.getWorkingDir(), 'instances', name);
        let modsDir = join(instDir, 'mods');

        let update = function (downloading = true, customColor = undefined)
        {
            let json = JSON.parse(fs.readFileSync(join(instDir, 'info.json')));
            json.downloading = downloading;
            json.customColor = customColor;
            fs.writeFileSync(join(instDir, 'info.json'), JSON.stringify(json));
        };

        if (manifest.overrides)
        {
            console.log(manifest.overrides);
            fs.mkdirSync(join(instDir, manifest.overrides));

            for (let i = 0; i < zipEntries.length; i++)
            {
                const zipEntry = zipEntries[i];
                if (zipEntry.entryName.includes('info.json')) continue;
                if (zipEntry.entryName.startsWith(manifest.overrides) || (manifest.mmcPack && zipEntry.entryName.includes(manifest.overrides)))
                {
                    zip.extractEntryTo(zipEntry.entryName, instDir, /*maintainEntryPath*/true, /*overwrite*/true);
                }
            }

            let overrides = manifest.mmcPack ? join(instDir, mmcPackName, manifest.overrides) : join(instDir, manifest.overrides);
            let files = fs.readdirSync(overrides);

            files.forEach(file =>
            {
                if (file.includes('info.json')) return;
                fs.move(join(overrides, file), join(instDir, file), {overwrite: true});
            });
        }

        update(true, 'rgb(0, 120, 0)');

        if (!fs.existsSync(modsDir)) fs.mkdirSync(modsDir);

        let promises = [];
        let mods = {};

        let green = 120;

        for (let i = 0; i < manifest.files.length; i++)
        {
            const file = manifest.files[i];

            if (i % 10 == 0 && green < 255)
            {
                green += 5;
                console.log('setting green to ' + green + '(' + manifest.files.length + ' / ' + i + ')');
                update(true, 'rgb(0, ' + green + ', 0)');
            }

            if (file.required)
            {
                let attempt = 0;
                let dl = undefined;
                while (dl === undefined)
                {
                    try
                    {
                        attempt++;
                        console.log('Requesting getAddonFileInformation for projectID: ' + file.projectID + ' and fileID: ' + file.fileID + ' attempt #' + attempt);
                        dl = await twitchappapi.getAddonFileInformation(file.projectID, file.fileID);
                    } catch (error)
                    {
                        console.error('Failed to request getAddonFileInformation for ' + file.projectID + ', trying again...');
                        dl = undefined;
                    }
                }
                let prm = downloadFile(join(modsDir, dl.fileName), dl.downloadUrl);
                promises.push(prm);
                let info = undefined;
                attempt = 0;
                while (info === undefined)
                {
                    try
                    {
                        attempt++;
                        console.log('Requesting addonInfo for projectID: ' + file.projectID + ' attempt #' + attempt);
                        info = await twitchappapi.getAddonInfo(file.projectID);
                    } catch (error)
                    {
                        console.error('Failed to request addonInfo for ' + file.projectID + ', trying again...');
                        info = undefined;
                    }
                }
                mods[dl.fileName.trim()] = {info: info, name: info.name, url: info.websiteUrl, fileInfo: dl};
            }
        }

        Promise.all(promises).then(() =>
        {
            update(false);
            fs.writeFileSync(join(instDir, 'mods.json'), JSON.stringify(mods));
            console.log('Set info.json downloading = false and saved instance mods.json');
        }).catch(err =>
        {
            console.log(err);
            alert('Could not download modpack! ' + err.message);
        });

    } catch (error)
    {
        console.error(error);
        alert('Invalid zip file! ' + error.message);
    }
}

function loadInstances()
{
    store = new Store(
        {
            configName: 'user-data',
            defaults: {}
        });

    let container = document.getElementById('instances');
    let instances = instanceManager.getInstances();
    let inst = 0;

    while (inst < container.childNodes.length)
    {
        if (instances[container.childNodes[inst].id])
        {
            delete instances[container.childNodes[inst].id];
            inst++;
        } else
        {
            container.removeChild(container.childNodes[inst]);
        }
    }

    if (Object.entries(instances).length !== 0) {
        let instances = instanceManager.getInstances();
        while (container.firstChild) container.removeChild(container.firstChild);

        let instancesArray = [];

        for (inst in instances)
        {
            instancesArray.push(instances[inst]);
        }

        instancesArray = instancesArray.sort(function (a, b)
        {
            a = new Date(a.info.dateCreated);
            b = new Date(b.info.dateCreated);
            return a > b ? -1 : a < b ? 1 : 0;
        });

        for (inst in instancesArray)
        {
            inst = instancesArray[inst];

            let add = '';

            if (inst.info.customColor)
            {
                add = `style="background-color: ${inst.info.customColor};"`;
            }

            container.innerHTML += `
    <article id=${inst.folder} class="location-listing" ${add}>
        <a class="location-title" href="#" oncontextmenu="return openMenu('${inst.folder}')" ondblclick="launchInstance('${inst.folder}')">${inst.info.displayName}</a>
        <div class="location-image"></div>
    </article>`;
        }

    }
}

function launchInstance(name)
{
    if (store.get('playing').playing) return alert('An instance is already running!');

    let instances = instanceManager.getInstances();

    let inst = instances[name];
    if (!inst) return;
    if (inst.info.downloading) return alert('The Instance is Currently Downloading!');

    let win = new remote.BrowserWindow(
        {
            width: 800,
            height: 500,
            x: 50,
            y: 50,
            webPreferences: {nodeIntegration: true}
        }
    );
    win.loadURL(`file://${__dirname}/console.html?name=${encodeURIComponent(name)}`);

    win.on('close', event =>
    {
        console.log('event');
        event.preventDefault();
        win.hide();
    });
}

ipcRenderer.on('launchInstance', async (event, data) =>
{
    console.log('launch: ' + data.name);
    launchInstance(data.name);
});

function openMenu(name)
{
    let instances = instanceManager.getInstances();
    store = new Store(
        {
            configName: 'user-data',
            defaults: {}
        });

    let inst = instances[name];
    if (!inst) return;
    if (inst.info.downloading) return alert('The Instance is Currently Downloading!');

    let bawdy = document.getElementById('bawdy');

    let extra = store.get('playing').playing ? '' : `
    <a href="javascript:deleteInstance('${name}');" class="rc-menu-item" onclick="this.parentElement.remove();">Delete instance</a>
    <a href="javascript:exportInstance('${name}');" class="rc-menu-item" onclick="this.parentElement.remove();">Export instance</a>
    `;

    let added = `
    <div class="rc-menu" id="rc-menu-instance" style="position: absolute; left: ${cursorX - 10}px; top: ${cursorY - 10}px;">
        ${extra ? '<a href="javascript:renameInstance(\'' + name + '\');" class="rc-menu-item" onclick="this.parentElement.remove();">Rename</a>' : ''}
        <a href="javascript:openSettings('${name}');" class="rc-menu-item" onclick="this.parentElement.remove();">Settings</a>
        ${inst.info.forge ? '<a href="javascript:openModManager(\'' + name + '\');" class="rc-menu-item" onclick="this.parentElement.remove();">Mod Manager</a>' : ''}
        <a href="javascript:openFolder('${name}');" class="rc-menu-item" onclick="this.parentElement.remove();">Open Folder</a>
        ${extra}
    </div>`;
    bawdy.innerHTML += added;
    let menu = document.querySelector('#rc-menu-instance');
    menu.style.left = Math.min(cursorX, window.innerWidth - menu.clientWidth) + 'px';
    menu.style.top = Math.min(cursorY, window.innerHeight - menu.clientHeight - document.querySelector('footer').clientHeight) + 'px';
}

deleteFolderRecursive = function (path)
{
    var files = [];
    if (fs.existsSync(path))
    {
        files = fs.readdirSync(path);
        files.forEach(function (file, index)
        {
            var curPath = path + '/' + file;
            if (fs.lstatSync(curPath).isDirectory())
            { // recurse
                deleteFolderRecursive(curPath);
            } else
            { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

async function renameInstance(name)
{
    let instances = instanceManager.getInstances();

    let inst = instances[name];
    if (!inst) return;
    if (inst.info.downloading) return alert('The Instance is Currently Downloading!');

    let newName = await dialogs.prompt('Enter new instance name', inst.info.displayName);
    if (!newName) return;

    let nameLowerCase = newName.toLowerCase().replace(/[/\\?%*:|"<>]/g, '').replace(/'/g, '').replace('"', '').substring(0, 20).trim();

    let instDir = join(instanceManager.getWorkingDir(), 'instances', name);
    let json = JSON.parse(fs.readFileSync(join(instDir, 'info.json')));
    json.name = nameLowerCase;
    json.displayName = newName.substring(0, 20).trim();

    fs.writeFileSync(join(instDir, 'info.json'), JSON.stringify(json));

    fs.move(instDir, join(instanceManager.getWorkingDir(), 'instances', nameLowerCase));
}

function deleteInstance(name)
{
    let instances = instanceManager.getInstances();

    let inst = instances[name];
    if (!inst) return;
    if (inst.info.downloading) return alert('The Instance is Currently Downloading!');

    if (confirm('Do you really want to delete the instance "' + inst.info.displayName + '"?'))
    {
        console.log('Deleting instance ' + name);

        deleteFolderRecursive(join(instanceManager.getWorkingDir(), 'instances', inst.folder));
    }
}

async function exportInstance(name)
{
    let instances = instanceManager.getInstances();

    let inst = instances[name];
    if (!inst) return;
    if (inst.info.downloading) return alert('The Instance is Currently Downloading!');

    let savePath = await dialog.showSaveDialog(null,
        {
            defaultPath: inst.folder,
            title: 'Save zip',
            filters: [{name: 'ZIP File', extensions: ['zip']}]
        });

    if (!savePath.filePath) return;
    savePath = savePath.filePath;

    console.log(savePath);

    let instanceFolder = join(instanceManager.getWorkingDir(), 'instances', inst.folder);
    let manifest = {};

    manifest.minecraft = {version: inst.info.version.id};
    if (inst.info.forge)
    {
        manifest.minecraft.modLoaders = [{id: 'forge-' + inst.info.forge.version, primary: true}];
    }

    manifest.manifestType = 'minecraftModpack';
    manifest.manifestVersion = 1;
    manifest.name = inst.info.displayName;
    manifest.overrides = 'overrides';
    manifest.files = [];

    const zip = new AdmZip();

    zip.addFile(manifest.overrides + '/', Buffer.alloc(0), 'over writes');


    let files = fs.readdirSync(instanceFolder);

    let blacklist = ['info.json', 'logs', 'mods', 'realms_persistence.json', 'lastlogin', '.ReAuth.cfg'];

    for (let i = 0; i < files.length; i++)
    {
        if (blacklist.includes(files[i])) continue;

        const file = join(instanceFolder, files[i]);
        if (fs.lstatSync(file).isDirectory())
        {
            zip.addLocalFolder(file, manifest.overrides + '/' + files[i]);
            continue;
        }

        zip.addLocalFile(file, manifest.overrides);
    }

    let modsJsonFile = join(instanceFolder, 'mods.json');
    let modsDirectory = join(instanceFolder, 'mods');

    if (fs.existsSync(modsJsonFile) && fs.existsSync(modsDirectory))
    {
        let mods = JSON.parse(fs.readFileSync(modsJsonFile));
        let modsInDir = fs.readdirSync(modsDirectory);

        for (let file in modsInDir)
        {
            const modFile = modsInDir[file];
            const mod = mods[modFile];
            const modPath = join(modsDirectory, modFile);

            if (fs.lstatSync(modPath).isDirectory())
            {
                zip.addLocalFolder(modPath, manifest.overrides + '/mods/' + modFile);

                continue;
            }

            if (mod)
            {
                manifest.files.push({projectID: mod.info.id, fileID: mod.fileInfo.id, required: true});
            } else
            {
                console.log('Found mod jar that was not in mods.jar list: ' + modFile + ', adding to overrides directory.');
                zip.addLocalFile(modPath, manifest.overrides + '/mods');
            }
        }
    }

    let jsonStringTmp = JSON.stringify(manifest);
    zip.addFile('manifest.json', Buffer.alloc(jsonStringTmp.length, jsonStringTmp), 'instance information');

    zip.writeZip(savePath);
    alert('Exported!');
}

async function openModManager(name)
{
    let instances = instanceManager.getInstances();

    let inst = instances[name];
    if (!inst) return;
    if (inst.info.downloading) return alert('The Instance is Currently Downloading!');

    let win = await window.open('modManager.html?name=' + encodeURIComponent(name), '_blank', 'nodeIntegration=yes, width=895, height=540');

    ipcRenderer.on('stoppedPlaying', async (event, data) =>
    {
        win.eval(`
        btn = document.getElementById('btn-launch');
        btn.classList.toggle('inst-menu-item-launch');
        btn.classList.toggle('inst-menu-item-launched');
        btn.disabled = false;`);
    });
}

async function openSettings(name)
{
    let instances = instanceManager.getInstances();

    let inst = instances[name];
    if (!inst) return;
    if (inst.info.downloading) return alert('The Instance is Currently Downloading!');

    let win = await window.open('settingsforinstance.html?name=' + encodeURIComponent(name), '_blank', 'nodeIntegration=yes, width=895, height=540');
}

function openFolder(name)
{
    let instances = instanceManager.getInstances();

    let inst = instances[name];
    if (!inst) return;

    shell.openItem(join(instanceManager.getWorkingDir(), 'instances', inst.folder));
}