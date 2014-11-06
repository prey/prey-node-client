var fs         = require('fs'),
    path       = require('path'),
    needle     = require('needle'),
    createHash = require('crypto').createHash,
    rmdir      = require('rimraf'),
    exec       = require('child_process').exec,
    whenever   = require('whenever'),
    os_name    = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    tmpdir     = os_name == 'windows' ? process.env.WINDIR + '\\Temp' : '/tmp';

var delayed    = whenever('buckle');

var npm_package_url  = 'https://registry.npmjs.org/prey';

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

  stream.on('data', function(chunk) {
    hash.update(chunk);
  });

  stream.on('error', function(e) {
    if (!error) cb(e);
    error = e;
  })

  stream.on('end', function() {
    if (!error) cb(null, hash.digest('hex'));
  });
}

var unpack = function(zip, dest, cb) {
  if (process.platform != 'darwin')
    return delayed.buckle.open(zip, dest, cb);

  // on OSX, we'll use ditto to ensure extended attributes are kept
  var cmd = 'ditto -xk ' + zip + ' ' + dest;
  exec(cmd, cb);
}

var package = module.exports;

package.verify_checksum = function(version, filename, file, cb) {
  var url = releases_url + version + '/' + checksums;

  log('Fetching checksums: ' + url);
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

package.new_version_available = function(branch, current, cb) {
  var method = 'get_' + branch + '_version';

  if (!package[method])
    return cb(new Error('Invalid branch.'));

  package[method](function(err, upstream_version) {
    if (err) return cb(err);

    var ver = is_greater_than(upstream_version, current) && upstream_version;
    cb(null, ver);
  })
}

package.get_stable_version = function(cb) {
  needle.get(releases_url + latest_text, function(err, resp, body) {
    var ver = body && body.toString().trim();
    // log('Latest upstream version: ' + ver);

    cb(err, ver);
  });
}

package.get_edge_version = function(cb) {
  needle.get(npm_package_url, { parse: true }, function(err, resp, body) {
    if (err) return cb(err);

    var version = body['dist-tags'] && body['dist-tags'].latest;
    if (version)
      return cb(null, version.toString().trim());

    cb(new Error('Unable to figure out latest edge version.'));
  })
}

package.get_latest = function(branch, current_version, dest, cb) {
  if (!current_version || !dest)
    throw new Error('Missing current version and/or destination.')

  package.new_version_available(branch, current_version, function(err, version) {
    if (err || !version)
      return cb(err || new Error('Already running latest version.'));

    package.get_version(version, dest, function(err) {
      cb(err, version);
    });
  });
};

package.get_version = function(version, dest, cb) {

  var final_path = path.join(dest, version);
  if (fs.existsSync(final_path))
    return cb(new Error('v' + version + ' already installed in ' + dest))

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
      url       = releases_url + version + '/' + release;

  package.download(url, function(err, file) {
    if (err) return cb(err);

    package.verify_checksum(version, release, file, function(err, valid) {
      if (err || !valid) {
        return fs.unlink(file, function() {
          return cb && cb(err || new Error('Invalid checksum for file: ' + release));
        })
      }

      log('File checksum is valid! ' + file)
      return cb && cb(null, file);
    })
  });
}

package.download = function(url, cb) {
  log('Downloading package: ' + url);
  // var file = system.tempfile_path(path.basename(url));
  var file = path.join(tmpdir, path.basename(url));

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

// example: package.install('/path/to/prey-mac-1.2.3.zip', '/usr/lib/prey/versions', cb)

package.install = function(zip, dest, cb) {
  log('Unpacking to ' + dest);

  if (!zip.match(/prey-(\w+)-([\d\.]+)/))
    return cb(new Error("This doesn't look like a Prey package: " + zip));

  var version    = path.basename(zip).match(/([\d\.]+)/)[1],
      new_path   = path.join(dest, 'prey-' + version),
      final_path = path.join(dest, version);

  var chmod = function(file) {
    if (fs.existsSync(file))
      fs.chmodSync(file, 0755);
  }

  var done = function(err, version) {
    cb(err, version);
  }

  // make sure target dir does not exist
  rmdir(new_path, function(err) {
    // if (err) log(err.message);

    unpack(zip, dest, function(err, result) {
      if (err) return done(err);

      fs.rename(new_path, final_path, function(err) {
        if (err) return done(err);

        // make absolutely sure that the bins are executable!
        if (os_name !== 'windows') {
          chmod(path.join(final_path, 'bin', 'node'));
          chmod(path.join(final_path, 'bin', 'prey'));
        }

        done(null, version);
      })
    });

  })

}
