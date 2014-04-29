var fs         = require('fs'),
    path       = require('path'),
    needle     = require('needle'),
    createHash = require('crypto').createHash,
    system     = require('./../system'),
    rmdir      = require('./../utils/rmdir'),
    os_name    = system.os_name;

var releases_host    = 'https://s3.amazonaws.com',
    releases_url     = releases_host + '/prey-releases/node-client/',
    latest_text      = 'latest.txt',
    checksums        = 'shasums.json',
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

// returns sha1 checksum for file
var checksum_for = function(file, cb) {
  var error,
      hash   = createHash('sha1'),
      stream = fs.ReadStream(file);

  stream.on('error', function(e) {
    if (!error) cb(e);
    error = e;
  })

  stream.on('data', function(d) {
    hash.update(d);
  });

  stream.on('end', function() {
    if (!error) cb(null, hash.digest('hex'));
  });
}

var verify_checksum = function(url, filename, file, cb) {
  log('Fetching checksum: ' + url);
  needle.get(url, { parse: true }, function(err, resp) {
    if (err) return cb(err);

    var checksum = resp.body[filename];
    if (!checksum)
      return cb(new Error('Unable to retrieve checksum for ' + filename));

    log('Got checksum from remote: ' + checksum + '. Calculating file hash...');
    checksum_for(file, function(err, res) {
      var valid = (res && res.trim() == checksum.trim());
      cb(err, valid);
    })
  })
}

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

  needle.get(releases_url + latest_text, function(err, resp, body) {
    var ver = body && body.toString().trim();
    log('Latest upstream version: ' + ver);

    cb(err, ver);
  });
}

package.get_latest = function(current_version, dest, cb){
  package.new_version_available(current_version, function(err, version) {
    if (err || !version)
      return cb(err || new Error('Already running latest version.'));

    if (fs.existsSync(path.join(dest, version)))
      return cb(new Error('Version ' + version + ' already installed.'));

    package.get_version(version, dest, function(err) {
      cb(err, version);
    });
  });
};

package.get_version = function(version, dest, cb) {
  log('Fetching version ' + version);
  package.download_release(version, function(err, file) {
    if (err) return cb(err);

    package.install(file, dest, function(err, installed_version) {
      fs.unlink(file, function() {
        cb(err, installed_version);
      })
    });
  });
}

package.download_release = function(version, cb) {

  var arch      = process.arch == 'x64' ? 'x64' : 'x86',
      release   = ['prey', os_name, version, arch].join('-') + package_format,
      host_path = releases_url + version + '/';

  package.download(host_path + release, function(err, file) {

    verify_checksum(host_path + checksums, release, file, function(err, valid) {
      if (err || !valid)
        return cb && cb(err || new Error('Invalid checksum for file: ' + release));

      log('File checksum is valid! ' + file)
      return cb && cb(null, file);
    })
  });
}

package.download = function(url, cb) {
  log('Downloading package: ' + url);
  var file = system.tempfile_path(path.basename(url));

  return cb(null, file);

  needle.get(url, { output: file }, function(err, resp, data) {

    if (err || resp.statusCode != 200)
      return cb && cb(err || new Error('Unexpected response: \n\n' + data.toString()));

    fs.exists(file, function(exists) {
      if (!exists) return cb && cb(new Error('File not found!'));

      log('Got file: ' + file)
      return cb && cb(null, file);
    });
  });
}

package.install = function(zip, dest, cb){
  log('Unpacking to ' + dest);

  var unzip = require('./../utils/unzip'); // dont load at startup to avoid fstream

  var version    = path.basename(zip).match(/([\d\.]+)/)[1],
      new_path   = path.join(dest, 'prey-' + version),
      final_path = path.join(dest, version);

  var chmod = function(file) {
    if (fs.existsSync(file))
      fs.chmodSync(file, 0755);
  }

  var done = function(err, version) {
    cb(err, version)
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
