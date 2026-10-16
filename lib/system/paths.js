// @ts-check
const fs = require('fs');
const path = require('path');

const osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
// eslint-disable-next-line import/no-dynamic-require, global-require
const paths = require(path.join(__dirname, osName, 'paths'));

const packagePath = path.resolve(__dirname, '..', '..');

module.exports = paths;
paths.package = packagePath;
paths.install = packagePath;
paths.current = packagePath;

/**
 * Windows only: when Prey runs from a managed install layout (current/versions),
 * anchor the config/log paths to the install root. This way a custom install
 * location keeps prey.conf, commands.db and prey.log next to the agent instead
 * of always under %WINDIR%\Prey.
 *
 * On a standard install `installPath` === %WINDIR%\Prey, so the returned values
 * match the hardcoded defaults (no-op). Returns null when no override applies
 * (non-Windows, or an unmanaged/dev layout), keeping the current behavior.
 *
 * @param {string} targetOs
 * @param {string} installPath
 * @param {boolean} managed
 * @returns {{config: string, log: string, log_file: string, log_restarts: string} | null}
 */
const deriveWindowsConfigPaths = (targetOs, installPath, managed) => {
  if (targetOs !== 'windows' || !managed) return null;
  return {
    config: installPath,
    log: installPath,
    log_file: path.join(installPath, 'prey.log'),
    log_restarts: path.join(installPath, 'prey_restarts.log'),
  };
};

// check if parent path directory is called 'versions'. if not, then we assume
// this was installed on a static location (eg. via apt-get), which means we
// can't keep different versions.

const packageParentPath = fs.realpathSync(path.resolve(packagePath, '..'));

let managedInstall = false;

if (path.basename(packagePath) === 'current') { // not symlinked (XP and below)
  paths.current = packagePath; // C:\Windows\Prey\Current
  paths.install = packageParentPath; // C:\Windows\Prey
  paths.versions = path.join(paths.install, 'versions');
  // eslint-disable-next-line global-require
  paths.package = path.join(paths.versions, require('../../package.json').version);
  managedInstall = true;
} else if (path.basename(packageParentPath) === 'versions') {
  paths.install = path.resolve(packageParentPath, '..');
  paths.current = path.join(paths.install, 'current');
  paths.versions = path.join(paths.install, 'versions');
  managedInstall = true;
}

// Windows: keep config/db/log alongside the install root so custom install
// locations keep their data together. No-op on standard installs.
const windowsConfigPaths = deriveWindowsConfigPaths(osName, paths.install, managedInstall);
if (windowsConfigPaths) Object.assign(paths, windowsConfigPaths);

// either /usr/local/lib/prey/versions/0.1.2/bin/prey
//     or /usr/local/lib/prey/bin/prey
paths.package_bin = path.join(paths.package, 'bin', paths.bin);

// either /usr/local/lib/prey/current/bin/prey
//     or /usr/local/lib/prey/bin/prey
paths.current_bin = path.join(paths.current, 'bin', paths.bin);
