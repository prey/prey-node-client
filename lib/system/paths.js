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

// The OS default config dir (on Windows, %WINDIR%\Prey) is also the "legacy" location
// where a pre-anchoring install keeps its data. Capture it now, before any override
// below can point `paths.config` at the install root.
const defaultConfigDir = paths.config;

/**
 * fs.existsSync that never throws (a broken path/permission issue degrades to false
 * instead of taking down the process at require time).
 *
 * @param {string} p
 * @returns {boolean}
 */
const safeExists = (p) => {
  try {
    return fs.existsSync(p);
  } catch (e) {
    return false;
  }
};

/**
 * Windows only: decide whether to anchor config/db/log to the install root.
 *
 * A fresh install has no commands.db anywhere (neither in the install root nor in the
 * legacy dir %WINDIR%\Prey), so it is safe — and desired — to anchor to the install
 * root: a fresh *custom* install then keeps its data in the chosen directory alongside
 * prey.conf/prey.log. An upgrade, by contrast, already has commands.db in the legacy
 * dir; if the install root is a different, still-empty custom dir we must NOT anchor,
 * or the running device would boot against a blank directory and lose its identity
 * (api_key/device_key). The same "don't anchor" rule reuses leftover legacy data on a
 * reinstall, preserving the previous identity.
 *
 * Rule: anchor when the data already lives in the install root, OR when there is no
 * legacy data to protect. Moving existing legacy data into a custom root is still an
 * explicit, opt-in operation (`prey config migrate_files`).
 *
 * @param {string} targetOs
 * @param {boolean} managed       whether this is a managed (versioned) install layout
 * @param {boolean} dbInInstall   commands.db present in the install root
 * @param {boolean} dbInLegacy    commands.db present in the legacy dir (%WINDIR%\Prey)
 * @returns {boolean}
 */
const shouldAnchorWindows = (targetOs, managed, dbInInstall, dbInLegacy) => {
  if (targetOs !== 'windows' || !managed) return false;
  return dbInInstall || !dbInLegacy;
};

/**
 * Windows only: anchor the config/log paths to the install root when `anchor` is set
 * (see shouldAnchorWindows for the decision).
 *
 * On a standard install `installPath` === %WINDIR%\Prey, so the returned values match
 * the hardcoded defaults (no-op). Returns null when no override applies (non-Windows,
 * an unmanaged/dev layout, or `anchor` is false), keeping the default behavior.
 *
 * @param {string} targetOs
 * @param {string} installPath
 * @param {boolean} managed
 * @param {boolean} anchor - whether config/db/log should anchor to `installPath`.
 * @returns {{config: string, log: string, log_file: string, log_restarts: string} | null}
 */
const deriveWindowsConfigPaths = (targetOs, installPath, managed, anchor) => {
  if (targetOs !== 'windows' || !managed || !anchor) return null;
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

// Windows: anchor config/db/log to the install root when the data already lives there
// (an existing/migrated install) OR when there is no legacy data to protect (a fresh
// install). This keeps upgrades safe (they never switch a running install to an empty
// dir) while letting a fresh custom install keep its data in the chosen directory.
const dbInInstall = safeExists(path.join(paths.install, 'commands.db'));
const dbInLegacy = safeExists(path.join(defaultConfigDir, 'commands.db'));
const anchor = shouldAnchorWindows(osName, managedInstall, dbInInstall, dbInLegacy);
const winPaths = deriveWindowsConfigPaths(osName, paths.install, managedInstall, anchor);
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
