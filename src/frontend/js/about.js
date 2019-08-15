const shell = require('electron').shell;
function openURL(url)
{
    shell.openItem(url);
}