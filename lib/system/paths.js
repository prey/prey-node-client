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
 * Windows only: anchor the config/log paths to the install root, but ONLY when the
 * data already lives there (commands.db present in the install root).
 *
 * Rationale: an existing install being upgraded keeps its data where it was (by
 * default %WINDIR%\Prey). If we anchored unconditionally, the agent would start
 * reading from the custom install root even when it is still empty, boot against a
 * blank directory and lose its identity (api_key/device_key). Keying the switch on
 * the presence of commands.db makes upgrades safe-by-default: the agent only uses the
 * install root once the data is actually there.
 *
 * Moving the data into a custom install root is an explicit, opt-in operation
 * (`prey config migrate_files`). Once commands.db has been copied there, the very next
 * boot satisfies `dataPresent` and the agent anchors to the install root naturally,
 * with no extra state to track.
 *
 * On a standard install `installPath` === %WINDIR%\Prey, so the returned values match
 * the hardcoded defaults (no-op). Returns null when no override applies (non-Windows,
 * an unmanaged/dev layout, or data not yet present), keeping the default behavior.
 *
 * @param {string} targetOs
 * @param {string} installPath
 * @param {boolean} managed
 * @param {boolean} dataPresent - whether commands.db already exists in `installPath`.
 * @returns {{config: string, log: string, log_file: string, log_restarts: string} | null}
 */
const deriveWindowsConfigPaths = (targetOs, installPath, managed, dataPresent) => {
  if (targetOs !== 'windows' || !managed || !dataPresent) return null;
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
//
// Guard realpathSync: a broken junction/symlink (or a missing parent) would throw
// here at require time and crash the whole process. Degrade to the plain resolved
// path instead so detection can still proceed without taking down the agent.
let packageParentPath;
try {
  packageParentPath = fs.realpathSync(path.resolve(packagePath, '..'));
} catch (e) {
  packageParentPath = path.resolve(packagePath, '..');
}

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

// Windows: anchor config/db/log to the install root only when the data already lives
// there, so an upgrade never switches a running install to an empty directory.
let dataAtInstall = false;
try {
  dataAtInstall = fs.existsSync(path.join(paths.install, 'commands.db'));
} catch (e) {
  dataAtInstall = false;
}
const winPaths = deriveWindowsConfigPaths(osName, paths.install, managedInstall, dataAtInstall);
if (winPaths) Object.assign(paths, winPaths);

// Diagnostic signals (consumed/logged by startup) so a fallback to the legacy config
// dir is observable instead of silent. `config_source` is 'install' when anchored to
// the install root, or 'default' when using the OS default config path.
paths.managed = managedInstall;
paths.config_source = winPaths ? 'install' : 'default';

// either /usr/local/lib/prey/versions/0.1.2/bin/prey
//     or /usr/local/lib/prey/bin/prey
paths.package_bin = path.join(paths.package, 'bin', paths.bin);

// either /usr/local/lib/prey/current/bin/prey
//     or /usr/local/lib/prey/bin/prey
paths.current_bin = path.join(paths.current, 'bin', paths.bin);
