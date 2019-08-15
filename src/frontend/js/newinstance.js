let Store = require('../../dest/store.js').Store;
let instanceManager = require('../../dest/instanceManager.js');

const store = new Store(
{
    configName: 'user-data',
    defaults: {}
});

let versions = store.get('versions');
let forgeVersions = store.get('forgeVersions');

let select = document.getElementById('version');

for(let i = 0; i < versions.versions.length; i++)
{
    let ver = versions.versions[i];

    var opt = document.createElement('option');
    opt.value = JSON.stringify(ver);
    opt.innerHTML = ver.type + " " + ver.id;
    select.appendChild(opt);
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
            selector.appendChild(opt);
        }
    }
}

function newInstance()
{
    let ipcRenderer = require('electron').ipcRenderer;
    const name = document.getElementById('name').value;
    const version = JSON.parse(document.getElementById('version').value);

    let val = document.getElementById('forgeversion').value;

    if(val) val = JSON.parse(val);
    
    ipcRenderer.send('newInstance', {name: name, version: version, forgeVersion: val});

    window.close();
}

let instances = instanceManager.getInstances();
function checkInstanceName()
{
    const name = document.getElementById('name').toLowerCase().trim().replace(/[/\\?%*:|"<>]/g, "").replace(/'/g, '').replace('"', '').substring(0, 20);
    document.getElementById('submit').disabled = instances[name] != undefined;

    for(var inst in instances)
    {
        inst = instances[inst];
        let result = inst.folder == name;
        if(result)
        {
            document.getElementById('submit').disabled = result;
            break;
        }
    }
}