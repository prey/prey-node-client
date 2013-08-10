var fs      = require('fs'),
    path    = require('path'),
    needle  = require('needle'),
    tmpdir  = require('os').tmpdir,
    rmdir   = require('rimraf'),
    os_name = process.platform.replace('win32', 'windows').replace('darwin', 'mac');

var releases_host    = 'http://s3.amazonaws.com',
    releases_url     = releases_host + '/prey-releases/node-client/',
    latest_text      = 'latest.txt',
    latest_checksums = 'latest/shasums.txt',
    package_format   = '.zip';

var log = function(str) {
  if (process.stdout.writable)
    process.stdout.write(str + '\n');
}

// returns true if first is greater than second
var is_greater_than = function(first, second){
  var a = parseFloat(first.replace(/\./, ''));
  var b = parseFloat(second.replace(/\./, ''));
  return a > b ? true : false;
};

var package = module.exports;

package.new_version_available = function(current, cb) {
  package.get_upstream_version(function(err, upstream_version) {
    if (err) return cb(err);

    var ver = is_greater_than(upstream_version, current) && upstream_version;
    cb(null, ver);
  })
}

package.get_upstream_version = function(cb){
  // log('Checking latest version...');

  var done = function(ver) {
    // log('Latest upstream version: ' + ver);
    cb(null, ver);
  }

  needle.get(releases_url + latest_text, function(err, resp, body){
    if (!err && body != '')
      return done(body.toString().trim());

    needle.get(releases_url + latest_checksums, function(err, resp, body){
      if (err) return cb(err);

      var match = body.match(/prey-([\d\.]+)\.zip/);
      if (!match)
        return cb(new Error('Unable to determine latest version from ' + latest_checksums))

      done(match[1]);
    });
  });

}

package.get_latest = function(current_version, dest, cb){
  package.new_version_available(current_version, function(err, version){
    if (err || !version)
      return cb(err || new Error('Already running latest version.'));

    if (fs.existsSync(path.join(dest, version)))
      return cb(new Error('Version ' + version + ' already installed.'));

    package.get_version(version, dest, function(err){
      cb(err, version);
    });
  });
};

package.get_version = function(version, dest, cb){
  log('Fetching version ' + version);
  package.download_release(version, function(err, file){
    if (err) return cb(err);
    package.install(file, dest, cb);
  });
}

package.download_release = function(version, cb){
  var arch = process.arch == 'x64' ? 'x64' : 'x86';
  var release = ['prey', os_name, version, arch].join('-') + package_format;
  var host_path = releases_url + version + '/';
  package.download(host_path + release, cb);
}

package.download = function(url, cb){
  log('Downloading package: ' + url);
  var file = path.join(tmpdir(), path.basename(url));

  needle.get(url, { output: file }, function(err, resp, data){
    if (err || resp.statusCode != 200)
      return cb && cb(err || new Error('Unexpected response: \n\n' + data.toString()));

    fs.exists(file, function(exists) {
      if (!exists) return cb(new Error('File not found!'));

      log('Got file: ' + file)
      return cb && cb(null, file);
    });
  });
}

package.install = function(zip, dest, cb){
  log('Unpacking to ' + dest);

  // dont load at startup to avoid fstream pollution
  var unzip = require(path.join(__dirname, 'utils', 'unzip'));

  var version    = path.basename(zip).match(/([\d\.]+)/)[1],
      new_path   = path.join(dest, 'prey-' + version),
      final_path = path.join(dest, version);

  var chmod = function(file) {
    if (fs.existsSync(file))
      fs.chmodSync(file, 0755);
  }

  var done = function(err, version) {
    fs.unlink(zip, function(e) {
      cb(err, version)
    })
  }

  // make sure target dir does not exist
  rmdir(new_path, function(err) {
    // if (err) log(err.message);

    unzip(zip, dest, function(err){
      if (err) return done(err);

      fs.rename(new_path, final_path, function(err){
        if (err) return done(err);

        // unzip files do not preserve executable bits, so we need to set them
        if (os_name !== 'windows') {
          chmod(path.join(final_path, 'bin', 'node'));
          chmod(path.join(final_path, 'bin', 'prey'));
        }

        done(null, version);
      })
    });

  })

}
