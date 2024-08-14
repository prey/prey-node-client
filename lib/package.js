const fs              = require('fs');
const path            = require('path');
const needle          = require('needle');
const createHash      = require('crypto').createHash;
const rmdir           = require('rimraf');
const cp              = require('child_process');
const whenever        = require('whenever');
const remove          = require('remover');
const storage         = require('./agent/utils/storage');
const is_greater_than = require('./agent/helpers').is_greater_than;
const paths           = require('./system/paths');
const os_name         = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const arch            = require('arch')();
const tmpdir          = os_name == 'windows' ? process.env.WINDIR + '\\Temp' : '/tmp';
const delayed         = whenever('buckle');
const fetchEnvVar = require('./utils/fetch-env-var');

var npm_package_url = 'https://registry.npmjs.org/prey';

var releases_host   = fetchEnvVar('prey_host_releases') ? fetchEnvVar('prey_host_releases') : 'https://downloads.preyproject.com',
    releases_url    = releases_host + '/prey-client-releases/node-client/',
    latest_text     = 'latest.txt',
    checksums       = 'shasums.json',
    package_format  = '.zip';

var MAX_UPDATE_ATTEMPS = 60,
    ongoing_attempt = 1;

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
      stream = fs.createReadStream(file);

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

var send_update_event = (type, status, old_version, new_version, attempt, error, cb) => {
  const config = require('./utils/configfile');
  var shared = require('./conf/shared');

  shared.keys.verify_current(function(err) {
    if (err) return cb(err);
    config.load(() => {
      package.get_update_data((res) => {
        var data = {
          name: 'client_install',
          info: {
            type:     type,
            status:   status,
            old_ver:  old_version,
            new_ver:  new_version,
            attempt:  attempt,
            error:    error,
            location: res.location,
            ip:       res.public_ip,
            country:  res.country,
            arch:     arch,
            os:       os_name,
            key:      config.getData('control-panel.device_key').toString() || null
          }
        }
  
        package.post_event(data, cb);
        // Get the local IP, the country and location
      });
    });
  });
}

/////////////////////////////////////////////////////////
// releases module

var releases = {};

releases.get_stable_version = function(cb) {
  const config = require('./utils/configfile');
  config.load(() => {
    const keyData = config.getData('control-panel.device_key');
    let key = keyData ? keyData.toString() : null;
    var options = {
      headers: { 'resource-dk': key }
    }
    needle.get(releases_url + latest_text, key ? options : null, function(err, resp, body) {
      var ver = body && body.toString().trim();
      // log('Latest upstream version: ' + ver);
  
      cb(err, ver);
    });
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
  var file = path.join(tmpdir, path.basename(url));

  if (fs.existsSync(file)) {
    log('Package already downloaded, moving on...')
    return cb(null, file);
  }

  log('Downloading package: ' + url);

  needle.get(url, { output: file }, function(err, resp, data) {

    if (err || resp.statusCode != 200)
      return cb && cb(err || new Error('Unexpected response: \n\n' + data.toString()));

    let exists = fs.existsSync(file);
    if (!exists) return cb && cb(new Error('File not found!'));

    log('Got file: ' + file)
    return cb && cb(null, file);
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
  if (os_name === 'mac'){
    cp.exec('sysctl sysctl.proc_translated', (err, stdout) => {
      if(err) {
        download_file(version, arch, cb);
      }else{
        const stdSlice = stdout.slice(stdout.length - 2, stdout.length - 1);
        if (parseInt(stdSlice) === 1) {
          download_file(version, 'arm64', cb);
        } else {
          cp.exec('arch', (errArch, stdoutArch) => {
            if (errArch) {
              download_file(version, arch, cb);
            } else { 
              download_file(version, stdoutArch, cb);
            }
          });
        }
      }
    });
  }else{
    download_file(version, arch, cb);
  }
}

const download_file = (version, _arch, cb) => {
  log(`Download file - version: ${version}/arch: ${_arch}`);
  var release = ['prey', os_name, version, _arch].join('-') + package_format,
  url     = releases_url + version + '/' + release;

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
};

/////////////////////////////////////////////////////////
// the package module

var package = {};

package.post_event = (data, cb) => {
  const common = require('./agent/common');
  const config = require('./utils/configfile');
  const protocol = config.getData('control-panel.protocol');
  const host = config.getData('control-panel.host');
  const url = `${protocol}://${host}/api/v2/telemetry`;

  var opts = {
    json: true,
    user_agent: common.system.user_agent
  }
  needle.post(url, data, opts, (err) => {
    return cb && cb(err);
  });
}

package.delete_attempts = (cb) => {
  storage.do('clear', {type: 'versions'}, (err) => {
    if (err) return cb(new Error("Error deleting update attempts registry: " + err.message));
    return cb && cb(err);
  });
}

// Update local update attemps db until the maximum number is reached, after that there's not gonna be
// more update attemps and the user is gonna be notified.


package.update_version_attempt = (old_version, new_version, attempt_plus, set_notified, error, cb) => {
  var create_version = function(version, cb) {
    // Before creating the registry the table it's cleared
    storage.do('clear', {type: 'versions'}, (err) => {
      if (err) return cb(new Error("Unable to edit local database, update cancelled"));
      storage.do('set', {type: 'versions', id: version, data: {from: old_version, to: new_version, attempts: 1, notified: 0}}, function(err) {
        if (err) return cb(new Error("Couldn't open local database, update cancelled"));
        return cb(null, true)
      })
    })
  }

  storage.do('all', {type: 'versions'}, (err, db) => {
    if (err || !db) return cb(new Error("Unable to load local database"));

    var db_version = db.find(x => x.id == new_version);

    if (db_version) {
      var current_attempt  = db_version.attempts,
          already_notified = db_version.notified,
          new_attempt = current_attempt;

      // In the case the previous version attempt hasn't been notified
      if (!already_notified) {
        var state = error ? 'failed' : 'success';
        // Enviar el evento de intento. No tengo el error disponible en esta etapa
        send_update_event('update', state, old_version, new_version, current_attempt, error, (err) => {
          if (err) log("Unable to notify previous attempt failure: " + err.message);
        })
      }

      if (attempt_plus) {
        if (current_attempt < MAX_UPDATE_ATTEMPS)
          new_attempt = current_attempt + 1;
        else
          return cb(null, false);
      }

      ongoing_attempt = new_attempt;

      storage.do('update', {type: 'versions', id: new_version, columns: ['attempts', 'notified'], values: [new_attempt, set_notified]}, (err) => {
        if (err) return cb(new Error("Unable to update db version values"));
        return cb(null, true)
      });

    } else {
      create_version(new_version, (err) => {
        if (err) return cb(new Error("Error creating version on db"));
        return cb(null, true) 
      });
    }

  });
}

// called from here and lib/conf/install when the update process failed or succeeded respectively
package.get_update_data = (cb) => {
  var location  = require('./agent/triggers/location'),
      data = {public_ip: null, country: null, location: {lat: null, lon: null}},
      loc = location.current;

  if (loc && loc.lat && loc.lng) {
    data.location.lat = loc.lat;
    data.location.lon = loc.lng;
    done();

  } else {
    var geo = require('./agent/providers/geo');
    geo.fetch_location((err, coords) => {
      if (err || !coords)
        return done();

      data.location.lat = coords.lat;
      data.location.lon = coords.lng;
      done();
    });
  }

  function done() {
    needle.get('http://ipinfo.io/geo', (err, resp, body) => {
      if (err || !body) {
        log("Unable to get geolocation info");
      } else {
        data.public_ip = body.ip;
        data.country   = body.country;
      }
      cb(data);
    });
  }
}

// called from lib/agent/updater to see whether to launch the 'config upgrade' process
package.new_version_available = function(branch, current, cb) {
  var method = 'get_' + branch + '_version';

  if (!releases[method])
    return cb(new Error('Invalid branch.'));

  releases[method](function(err, upstream_version) {
    if (err) return cb(err);

    var ver = is_greater_than(upstream_version, current) && upstream_version;
    cb(null, ver, releases_host);
  })
}

// called from lib/conf/install when no specific version is passed to 'config upgrade'
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

// called from lib/conf/install when a specific version is passed, e.g. 'config upgrade 1.2.3'
package.get_version = function(version, dest, cb) {
  var common = require('./common');
  // New registry or increment attempt count
  package.update_version_attempt(common.version, version, 1, 0, "Failed previous attempt", (err, update) => {
    if (err) return cb(err);
    if (update) {
      package.download_install(version, dest, function(err) {
        cb(err, version);
      });
    } else {
      return cb(new Error("Maximum number of upgrade attempts reached"));
    }
  });
}

package.download_install = function(version, dest, cb) {
  var final_path = path.join(dest, version);
  if (fs.existsSync(final_path)) {
    switch (ongoing_attempt % 10) {
      case 3:
        setTimeout(() => {package.restart_client()}, 3000);
        break;
      case 5:
        setTimeout(() => {package.activate_version(version)}, 3000);
        break;
      case 7:
        setTimeout(() => {package.delete_version(version)}, 3000);
        break;
    }
    return cb(new Error('v' + version + ' already installed in ' + dest))
  }

  log('Fetching version ' + version);
  releases.download_verify(version, function(err, file) {
    if (err) return cb(err);

    package.install(file, dest, function(err, installed_version) {
      cb(err, installed_version);
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
      fs.chmodSync(file, 0o755);
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

// called from lib/agent/updater if there's a new client version installed, if that the case the update success event is sent
package.check_update_success = function(new_version, versions_path, cb) {
  storage.do('all', {type: 'versions'}, (err, db) => {
    if (err || !db) return cb && cb(err);

    var db_version = db.find(x => x.id == new_version);   // -> undefined si no existe la version

    // if (db.some(x => x.id == new_version) &&
    if (db_version && db_version.notified == 0) {
      // If the registry with the new version exists the event is sent, then the registry is deleted.
      var old_version = db_version.from || null,
          attempt = db_version.attempts || null;

      // Delete older versions previous to the last 2
      package.delete_older_versions(old_version, new_version, versions_path);

      send_update_event('update', 'success', old_version, new_version, attempt, null, (err) => {
        if (err) return cb(new Error("Error sending the update success event: " + err.message));

        storage.do('clear', {type: 'versions'}, (err) => {
          if (err) return cb(new Error("Error deleting update attempts registry: " + err.message));
          return cb && cb(err);
        });
      });
    } else {
      // Clear the database in the case there's an older update registry stored
      if (Object.keys(db).length > 0)
      storage.do('clear', {type: 'versions'});
      return cb();
    }
  })
}

package.delete_older_versions = function(old_ver, new_ver, versions_path) {
  var common = require('./common');
  // Check new_ver format so it won't try to delete it
  if (!new_ver || !new_ver.match(/^(?:[\dx]{1,3}\.){0,3}[\dx]{1,3}/g)) return;

  // Get all the versions from the directory, then exclude the new and the last one
  fs.readdir(versions_path, function(err, all_versions) {
    if (!all_versions) return;
    all_versions = all_versions.filter(function(version) {
      return version != old_ver && version != new_ver && version != common.version;
    })

    // Now delete the rest
    all_versions.forEach(function(dir) {
      var directory = path.join(versions_path, dir);
      remove(directory, function() {
        log("Version " + dir + " deleted");
      });
    })
  })
}

package.restart_client = () => {
  var common = require('./common');

  log('Restarting client...')
  var restart_cmd = os_name == 'windows' ? 'taskkill /F /PID ' : 'kill -9 ',
      pid = fs.readFileSync(common.pid_file);

  if (pid) cp.exec(restart_cmd + pid);
}

package.activate_version = (version) => {
  if (!version) return;

  log('Activating version ' + version + ' and restarting client...')
  var install = require('./conf/install');

  install.activate_new_version(version, (err) => {
    if (!err) package.restart_client();
  });
}

package.delete_version = (version) => {
  if (!version) return;

  log('Deleting version ' + version + ' and restarting client...')
  remove(path.join(paths.versions, version), (err) => {
    if (err) log("Unable to delete " + version + " version");
    else {
      package.restart_client();
    }
  })
}

module.exports = package;