var fs         = require('fs'),
    path       = require('path'),
    osName    = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    paths      = require(path.join(__dirname, osName, 'paths'));

var package_path  = path.resolve(__dirname, '..', '..');

module.exports = paths;
paths.package  = package_path;
paths.install  = package_path;
paths.current  = package_path;

// check if parent path directory is called 'versions'. if not, then we assume
// this was installed on a static location (eg. via apt-get), which means we
// can't keep different versions.

var package_parent_path = fs.realpathSync(path.resolve(package_path, '..'));

if (path.basename(package_path) == 'current') { // not symlinked (XP and below)

  paths.current  = package_path; // C:\Windows\Prey\Current
  paths.install  = package_parent_path; // C:\Windows\Prey
  paths.versions = path.join(paths.install, 'versions');
  paths.package  = path.join(paths.versions, require('./../../package.json').version);

} else if (path.basename(package_parent_path) == 'versions') {

  paths.install  = path.resolve(package_parent_path, '..');
  paths.current  = path.join(paths.install, 'current');
  paths.versions = path.join(paths.install, 'versions');

}

// either /usr/local/lib/prey/versions/0.1.2/bin/prey
//     or /usr/local/lib/prey/bin/prey
paths.package_bin = path.join(paths.package, 'bin', paths.bin);

// either /usr/local/lib/prey/current/bin/prey
//     or /usr/local/lib/prey/bin/prey
paths.current_bin = path.join(paths.current, 'bin', paths.bin);
