var fs      = require('fs'),
    path    = require('path'),
    needle  = require('needle'),
    tmdir   = require('os').tmpdir,
    rmdir   = require('rimraf'),
    os_name = process.platform.replace('win32', 'windows').replace('darwin', 'mac');

var releases_host    = 'http://s3.amazonaws.com',
    releases_url     = releases_host + '/prey-releases/node-client/',
    latest_text      = 'latest.txt',
    latest_checksums = 'latest/shasums.txt',
    releases_format   = '.zip';

var releases = {};

var log = function(str) {
  if (process.stdout.writable)
    process.stdout.write(str + '\n');
}

var download_release = function(version, cb){
  var arch = process.arch == 'x64' ? 'x64' : 'x86';
  var release = ['prey', os_name, version, arch].join('-') + releases_format;
  var host_path = releases_url + version + '/';
  download(host_path + release, cb);
}

var download = function(url, cb){
  log('Downloading releases: ' + url);
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

exports.check_latest = function(cb){
  log('Checking latest version...');

  var done = function(ver) {
    log('Latest upstream version: ' + ver);
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

exports.get_latest = function(current_version, dest, cb){
  releases.check_latest_version(function(err, upstream_version){
    if (err || upstream_version == current_version)
      // return cb(err); // if err is empty, the process will set and the latest version IS set
      return cb(err || new Error('Already running latest version: ' + upstream_version));

    if (fs.existsSync(path.join(dest, upstream_version)))
      return cb(new Error('Version ' + upstream_version + ' already installed.'));

    releases.get_version(upstream_version, dest, function(err){
      cb(err, upstream_version);
    });
  });
};

exports.get_version = function(version, dest, cb){
  log('Fetching version ' + version);
  releases.download_release(version, function(err, file){
    if (err) return cb(err);
    releases.install(file, dest, cb);
  });
}

exports.install = function(zip, dest, cb){
  log('Unpacking to ' + dest);

  var unzip = require('./../utils/unzip'); // dont load at startup to avoid fstream

  var version    = path.basename(zip).match(/([\d\.]+)/)[1],
      new_path   = path.join(dest, 'prey-' + version),
      final_path = path.join(dest, version);

  var chmod = function(file) {
    if (fs.existsSync(file))
      fs.chmodSync(file, 0755);
  }

  // make sure target dir does not exist
  rmdir(new_path, function(err) {
    // if (err) log(err.message);

    unzip(zip, dest, function(err){
      if (err) {
        if (fs.existsSync(zip)) fs.unlinkSync(zip);
        return cb(err);
      }

      fs.rename(new_path, final_path, function(err){
        if (err) return cb(err);

        // unzip files do not preserve executable bits, so we need to set them
        if (os_name !== 'windows') {
          chmod(path.join(final_path, 'bin', 'node'));
          chmod(path.join(final_path, 'bin', 'prey'));
        }

        cb(null, version);
      })
    });

  })

}

module.exports = releases;
