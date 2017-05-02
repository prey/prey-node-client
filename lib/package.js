var fs              = require('fs'),
    path            = require('path'),
    needle          = require('needle'),
    createHash      = require('crypto').createHash,
    rmdir           = require('rimraf'),
    cp              = require('child_process'),
    whenever        = require('whenever'),
    storage         = require('./agent/utils/storage');
    is_greater_than = require('./agent/helpers').is_greater_than,
    os_name         = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    arch            = process.arch == 'x64' ? 'x64' : 'x86',
    tmpdir          = os_name == 'windows' ? process.env.WINDIR + '\\Temp' : '/tmp';

var delayed         = whenever('buckle');

var npm_package_url = 'https://registry.npmjs.org/prey';

var releases_host   = 'https://downloads.preyproject.com',
    releases_url    = releases_host + '/prey-client-releases/node-client/',
    latest_text     = 'latest.txt',
    checksums       = 'shasums.json',
    package_format  = '.zip';

var MAX_UPDATE_ATTEMPS = 3;

/////////////////////////////////////////////////////////
// helpers

var log = function(str) {
  if (process.stdout.writable)
    process.stdout.write(str + '\n');
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

  // increase maxBuffer to avoid [stderr maxBuffer exceeded]
  cp.exec(cmd, { maxBuffer: 1024 * 1024 * 64 }, cb);
}

var move = function(from, to, cb) {
  if (process.platform != 'win32')
    return fs.rename(from, to, cb);

  // on windows, antivirus softwares lock new folders until all files are scanned
  // which causes a EPERM error when doing a fs.rename. to prevent this from ruining
  // the process, we'll retry the fs.rename 10 times every one second if we do get a EPERM error.
  function like_a_boss(attempt) {
    fs.rename(from, to, function(err) {
      if (err) log('Error when moving directory: ' + err.message);

      // if no error, or err is not EPERM/EACCES, we're done
      if (!err || (err.code != 'EPERM' && err.code != 'EACCES'))
        cb();
      else if (attempt >= 30) // max attempts reached, so give up.
        cb(err);
      else
        setTimeout(function() { like_a_boss(attempt + 1) }, 1000);

    })
  }

  like_a_boss(1);
}

// Update local update attemps db until the maximum number is reached, after that there's not gonna be
// more update attemps and the user is gonna be notified.
var update_attempts = function(version, cb) {

  var exist = function(db) {
    var key = ['version', version].join('-');
    if (db[key]) {
      return true;
    }
    return false;
  }

  var update_versions = function(version, attempt_del, notif_add, cb) {
    var key = ["version", version].join("-"),
        attempt_add = attempt_del,
        notif_del = notif_add;

    var version_del,
        version_add,
        obj_del = {},
        obj_add = {};

    if (notif_add) notif_del = !notif_add;
    else attempt_add = attempt_del + 1;

    version_del = { "version": version, "attempts": attempt_del, "notified": notif_del };
    version_add = { "version": version, "attempts": attempt_add, "notified": notif_add };

    obj_del[key] = version_del;
    obj_add[key] = version_add;

    storage.update(key, obj_del, obj_add, cb);
  }

  storage.all('versions', function(err, db) {
    if (err) return cb(new Error("Unable to load local database, update cancelled"));

    var count = Object.keys(db).length;
    if (count > 0 && exist) {
      var key     = ['version', version].join('-'),
          attempt = db[key].attempts;

      if (db[key].attempts < MAX_UPDATE_ATTEMPS) {
        // Number of attempts ++
        update_versions(version, attempt, false, function(err) {
          if (err) return cb(new Error("Unable to update local database, update cancelled"));
          cb(null, true);
        });
      } else {
        if (!db[key].notified) {
          // Send the event when the maximum update attemps are reached
          package.get_update_data(function(res) {
            var api = require('./agent/plugins/control-panel/api');
            var data = {
              name: 'device_client_updated',
              info: {
                status:  'failed',
                old_ver: res.from,
                new_ver: res.to,
                ip:      res.public_ip,
                country: res.country,
                arch:    arch,
                os:      os_name
              }
            }
            api.push['event'](data, {}, function(err, res) {
              if (err) log("Error sending the fail upgrade event");
              if (res.statusCode == 200) {
                log("Notifying update error to user");

                update_versions(version, attempt, true, function(err) {
                  if (err) log("Error updating notification status");
                });
              }
            });
          });
        }
        cb(null, false);
      }
    } else {
      // Set the new client version attempts in the local database
      var key = ['version', version].join('-');
      storage.set(key, {version: version, attempts: 1, notified: false}, function(err) {
        if (err) return cb(new Error("Couldn't open local database, update cancelled"));
        cb(null, true)
      })
    }
  })
}

/////////////////////////////////////////////////////////
// releases module

var releases = {};

releases.get_stable_version = function(cb) {
  needle.get(releases_url + latest_text, function(err, resp, body) {
    var ver = body && body.toString().trim();
    // log('Latest upstream version: ' + ver);

    cb(err, ver);
  });
}

releases.get_edge_version = function(cb) {
  needle.get(npm_package_url, { parse: true }, function(err, resp, body) {
    if (err) return cb(err);

    var version = body['dist-tags'] && body['dist-tags'].latest;
    if (version)
      return cb(null, version.toString().trim());

    cb(new Error('Unable to figure out latest edge version.'));
  })
}

releases.download = function(url, cb) {
  // var file = system.tempfile_path(path.basename(url));
  var file = path.join(tmpdir, path.basename(url));

  if (fs.existsSync(file)) {
    log('Package already downloaded, moving on...')
    return cb(null, file);
  }

  log('Downloading package: ' + url);

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

releases.verify_checksum = function(version, filename, file, cb) {

  function parse_sums(body) {
    if (typeof body == 'object')
      return body;

    var data = {};
    try { data = JSON.parse(body) } catch(e) { /* bummer */ };
    return data;
  }

  var url = releases_url + version + '/' + checksums;
  log('Fetching checksums: ' + url);

  needle.get(url, { parse: true }, function(err, resp) {
    if (err) return cb(err);

    var checksum = parse_sums(resp.body)[filename];
    if (!checksum)
      return cb(new Error('Unable to retrieve checksum for ' + filename));

    log('Got checksum from remote: ' + checksum + '. Calculating file hash...');
    checksum_for(file, function(err, res) {
      var valid = (res && res.trim() == checksum.trim());
      cb(err, valid);
    })
  })
}

releases.download_verify = function(version, cb) {

  var release   = ['prey', os_name, version, arch].join('-') + package_format,
      url       = releases_url + version + '/' + release;

  releases.download(url, function(err, file) {
    if (err) return cb(err);

    releases.verify_checksum(version, release, file, function(err, valid) {
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

/////////////////////////////////////////////////////////
// the package module

var package = {};

// called from here and lib/conf/install when the update process failed or succeeded respectively
package.get_update_data = function(cb) {
  var common = require('./common'),
      data   = {from: null, to: null, public_ip: null, country: null};

  data.from = common.version;
  releases.get_stable_version(function(err, ver) {
    if (err) log("Unable to get last client version");
    else data.to = ver;
    needle.get('http://ipinfo.io/geo', function(err, resp, body) {
      if (err || !body) {
        log("Unable to get geolocation info");
      } else {
        data.public_ip = body.ip;
        data.country   = body.country;
      }
      cb(data);
    })
  });
}

// called from lib/agent/updater to see whether to launch the 'config upgrade' process
package.new_version_available = function(branch, current, cb) {
  var method = 'get_' + branch + '_version';

  if (!releases[method])
    return cb(new Error('Invalid branch.'));

  releases[method](function(err, upstream_version) {
    if (err) return cb(err);

    var ver = is_greater_than(upstream_version, current) && upstream_version;
    cb(null, ver);
  })
}

// called from lib/conf/install when no specific version is passed to 'config upgrade'
package.get_latest = function(branch, current_version, dest, cb) {
  if (!current_version || !dest)
    throw new Error('Missing current version and/or destination.')

  package.new_version_available(branch, current_version, function(err, version) {
    if (err || !version)
      return cb(err || new Error('Already running latest version.'));

    package.check_upgrade(version, dest, function(err) {
      cb(err, version);
    });
  });
};

// called from lib/conf/install when a specific version is passed, e.g. 'config upgrade 1.2.3'
package.check_upgrade = function(version, dest, cb) {
  var keys   = require('./agent/plugins/control-panel/api/keys'),
      shared = require('./conf/shared');

  if (process.argv[7] == 'test') {
    return package.get_version(version, dest, function(err) {
      cb(err, version);
    });
  }
  // The upgrade process it's gonna start only when the account is verified.
  shared.keys.verify_current(function(err) {
    if (err) return cb(new Error("Missing user credencials, update cancelled for now"));

    update_attempts(version, function(err, update) {
      if (err) return cb(err);
      if (update) {
        package.get_version(version, dest, function(err) {
          cb(err, version);
        });
      } else {
        return cb(new Error("Maximum number of upgrade attempts reached"));
      }
    });
  });
}

package.get_version = function(version, dest, cb) {

  var final_path = path.join(dest, version);
  if (fs.existsSync(final_path))
    return cb(new Error('v' + version + ' already installed in ' + dest))

  log('Fetching version ' + version);
  releases.download_verify(version, function(err, file) {
    if (err) return cb(err);

    package.install(file, dest, function(err, installed_version) {
      fs.unlink(file, function() {
        cb(err, installed_version);
      })
    });
  });
}

// called from lib/conf/install when 'config install [package.zip]' is called
// example: package.install('/path/to/prey-mac-1.2.3.zip', '/usr/lib/prey/versions', cb)
package.install = function(zip, dest, cb) {

  if (!zip.match(/prey-(\w+)-([\d\.]+)/))
    return cb(new Error("This doesn't look like a Prey package: " + zip));

  var version    = path.basename(zip).match(/([\d\.]+)/)[1],
      new_path   = path.join(dest, 'prey-' + version),
      final_path = path.join(dest, version);

  function executify(file) {
    if (fs.existsSync(file))
      fs.chmodSync(file, 0755);
  }

  function undo(err) {
    // if something went wrong, ensure the final folder is removed before exiting,
    // otherwise we might hit the 'already installed' error in get_latest(),
    // in the future. this function ensures the new_path is removed before
    // unzipping so no need to rmdir() that one.
    rmdir(final_path, function() {
      cb(err, version);
    })
  }

  // make sure target dir does not exist
  log("Ensuring path doesn't exist: " + new_path);
  rmdir(new_path, function(err) {
    // if (err) log(err.message);

    log('Unpacking to ' + dest);
    unpack(zip, dest, function(err, result) {
      if (err) return cb(err);

      log('Moving to ' + final_path);
      move(new_path, final_path, function(err) {
        if (err) return undo(err);

        // make absolutely sure that the bins are executable!
        if (os_name !== 'windows') {
          executify(path.join(final_path, 'bin', 'node'));
          executify(path.join(final_path, 'bin', 'prey'));
        }

        cb(null, version);
      })

    });

  })

}

module.exports = package;