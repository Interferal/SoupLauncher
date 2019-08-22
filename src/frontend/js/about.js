const shell = require('electron').shell;
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

function openURL(url)
{
    shell.openItem(url);
}