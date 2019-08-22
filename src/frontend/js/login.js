let ipcRenderer = require('electron').ipcRenderer;
let remote = require('electron').remote;


remote.getCurrentWindow().setMenu(null);

document.addEventListener('keydown', (e) =>
{
	if (e.which === 123) 
	{
		//@ts-ignore
		remote.getCurrentWindow().toggleDevTools();
	} else if (e.which === 116) 
	{
		location.reload();
	}
});


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

if($_GET['flash'])
{
    let flashMsg = $_GET['flash'];

    document.getElementById('flashDiv').innerHTML += '<div class="flashbox"><div class="alert alert-danger">' + flashMsg + '</div></div>';
}

function login()
{
    let email = document.getElementById('email').value;
    let password = document.getElementById('password').value;

    let elem = document.getElementById('submit');
    elem.disabled = true;
    elem.innerHTML = "Logging in please wait (loading forge versions)...";

    ipcRenderer.send('submitForm', {email: email, password: password});
    return false;
}