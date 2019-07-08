const createWindowsInstaller = require('electron-winstaller').createWindowsInstaller
const path = require('path')

getInstallerConfig()
  .then(createWindowsInstaller)
  .catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })

function getInstallerConfig () {
  console.log('creating windows installer')
  const rootPath = path.join('./')
  const outPath = path.join(rootPath, 'release-builds')
  const icon = path.join(rootPath, 'assets', 'icons', 'win', 'icon.ico')
  console.log(icon);

  return Promise.resolve({
    appDirectory: path.join(outPath, 'soup-launcher-win32-ia32/'),
    authors: 'Souper',
    noMsi: true,
    outputDirectory: path.join(outPath, 'windows-installer'),
    exe: 'soup-launcher.exe',
    setupExe: 'SoupLauncherInstaller.exe',
    setupIcon: icon,
    description: "Custom Minecraft Launcher"
  })
}