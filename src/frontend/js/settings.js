let os = require('os');
let remote = require('electron').remote;

remote.getCurrentWindow().setMenu(null);

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

document.getElementById('memory').max = (os.totalmem() / (1024*1024));

function updateRamAmt(amt)
{
    document.getElementById('memAmt').innerHTML = amt + " Mb";
}

let Store = require('../../dest/store.js').Store;

let store = new Store(
{
    configName: 'user-data',
    defaults: {}
});

document.getElementById('memory').value = store.get('memory').maxMemory;
updateRamAmt(store.get('memory').maxMemory);

document.getElementById('javaArgs').value = store.get('javaArgs').replace('\n', '').trim();

function save()
{
    let mem = store.get('memory');
    mem.maxMemory = parseInt(document.getElementById('memory').value);
    
    store.set('javaArgs', document.getElementById('javaArgs').value.replace('\n', '').trim());
    store.set('memory', mem);
    
    window.close();
}