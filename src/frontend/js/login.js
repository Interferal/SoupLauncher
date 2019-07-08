let ipcRenderer = require('electron').ipcRenderer;

function login()
{
    let email = document.getElementById('email').value;
    let password = document.getElementById('password').value;

    let elem = document.getElementById('submit');
    elem.disabled = true;
    elem.innerHTML = "Logging in please wait...";

    ipcRenderer.send('submitForm', {email: email, password: password});
    return false;
}