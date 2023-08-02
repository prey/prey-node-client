const fs = require('fs');
const path = require('path');

const osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
// eslint-disable-next-line import/no-dynamic-require
const paths = require(path.join(__dirname, osName, 'paths'));
const { version } = require('../../package.json');

const packagePath = path.resolve(__dirname, '..', '..');

paths.package = packagePath;
paths.install = packagePath;
paths.current = packagePath;

// check if parent path directory is called 'versions'. if not, then we assume
// this was installed on a static location (eg. via apt-get), which means we
// can't keep different versions.
const packageParentPath = fs.realpathSync(path.resolve(packagePath, '..'));

if (path.basename(packagePath) === 'current') { // not symlinked (XP and below)
  paths.current = packagePath; // C:\Windows\Prey\Current
  paths.install = packageParentPath; // C:\Windows\Prey
  paths.versions = path.join(paths.install, 'versions');
  paths.package = path.join(paths.versions, version);
} else if (path.basename(packageParentPath) === 'versions') {
  paths.install = path.resolve(packageParentPath, '..');
  paths.current = path.join(paths.install, 'current');
  paths.versions = path.join(paths.install, 'versions');
}

// either /usr/local/lib/prey/versions/0.1.2/bin/prey
// or /usr/local/lib/prey/bin/prey
paths.package_bin = path.join(paths.package, 'bin', paths.bin);

// either /usr/local/lib/prey/current/bin/prey
// or /usr/local/lib/prey/bin/prey
paths.current_bin = path.join(paths.current, 'bin', paths.bin);

module.exports = paths;
