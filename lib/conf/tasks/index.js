const fs = require('fs');
const async = require('async');
const shared = require('./../shared');
const common = require('./../../common');
const paths = common.system.paths;
const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const is_mac = osName == 'mac';
const chmodr = require('chmodr');
const prey_owl = require('./prey_owl');
const api = require('./../../agent/control-panel/api');

const isWindows = osName === 'windows';
exports.chmodr = chmodr;

const client  = require('needle');
const host    = 'https://127.0.0.1:7739';
const osHooks = require('./os/' + osName);
const daemon = require('./daemon');
const prey_user = require('./prey_user');
const clear_folders = require('./clear_folders');
const clear_files_temp = require('./clear_files_prey_temp');

const log = (str) => shared.log(str);

const ensure_dir = (dir, cb) => {
  const exists = fs.existsSync(dir) 
  if (exists) return cb();
  fs.mkdir(dir, cb);
};

const setUpConfig = function (cb) {
  log(`Ensuring presence of config dir: ${paths.config}`);
  ensure_dir(paths.config, function (err) {
    if (err) return cb(err);
    cb();
    //log(`Syncing ${common.config.path} with ${common.default_config_file}`);
    //common.config.sync(common.default_config_file, 'nonempty', cb);
  });
};

const verify_node_signature = function(cb) {
  if (osName !== 'mac') return cb();

  const node_path = paths.current + '/bin/node';
  if (!fs.existsSync(node_path)) {
    log('Warning: Node binary not found at: ' + node_path);
    return cb();
  }

  log('Verifying node binary signature...');
  const { exec } = require('child_process');

  // Check signature details
  exec(`codesign -dvvv "${node_path}" 2>&1`, function(err, stdout, stderr) {
    const output = stdout + stderr;
    log('Signature details:\n' + output);

    // Verify signature
    exec(`codesign --verify --verbose=4 "${node_path}" 2>&1`, function(err, stdout, stderr) {
      const verifyOutput = stdout + stderr;
      if (err) {
        log('ERROR: Node binary signature verification FAILED');
        log('Verification output:\n' + verifyOutput);
        log('This may cause SIGKILL when launched by launchd');
      } else {
        log('SUCCESS: Node binary signature verified');
      }

      // Check with spctl (Gatekeeper)
      exec(`spctl -a -t exec -vv "${node_path}" 2>&1`, function(err, stdout, stderr) {
        const spctlOutput = stdout + stderr;
        log('Gatekeeper assessment:\n' + spctlOutput);
        cb();
      });
    });
  });
};

const setUpVersion = function (version, cb) {
  const finish = () => {
    log(`Setting permissions on ${paths.current}`);
    exports.chmodr(paths.current, 0o755, function (err) {
      if (err) return cb(err);

      // Verify node signature and log details for debugging
      verify_node_signature(function() {
        client.put(host, null, { timeout: 4500 }, () => {
          log('Running post_activate hooks...');
          osHooks.post_activate(cb);
        });
      });
    });
  }

  setUpConfig(function (err) {
    if (err) return cb(err);

    if (!paths.versions) {
      log('No versions support.');
      return finish();
    }

    log('Setting up ' + version + ' as current...');
    shared.version_manager.set_current(version, function (err) {
      if (err) {
        if (err.code == 'ALREADY_CURRENT')
          log('Warning: This version is already set as current.');
        else return cb(err);
      }
      finish();
    });
  });
};

const cleanup_old_versions = function(cb) {
  if (!paths.versions) return cb();

  const current_version = shared.version_manager.this();
  const all_versions = shared.version_manager.list();

  if (all_versions.length <= 1) {
    log('Only one version exists, no cleanup needed');
    return cb();
  }

  log('Cleaning up old versions, keeping only current: ' + current_version);

  const to_remove = all_versions.filter(v => v !== current_version);
  const async = require('async');

  async.eachSeries(to_remove, function(version, next) {
    const version_path = paths.versions + '/' + version;
    log('Removing old version: ' + version);
    const rmdir = require('rimraf');
    rmdir(version_path, next);
  }, function(err) {
    if (err) log('Warning: Error during cleanup: ' + err.message);
    else log('Cleanup completed successfully');
    cb(); // Continue even if cleanup fails
  });
};

exports.activate = (values, cb) => {
  // On macOS, unload daemon before making changes to avoid WatchPaths triggering premature restart
  if (osName === 'mac') {
    log('Unloading daemon before activation to prevent race conditions...');
    const { exec } = require('child_process');
    const daemon_key = 'com.prey.agent';

    exec(`launchctl unload /Library/LaunchDaemons/${daemon_key}.plist`, function(err) {
      if (err) log('Warning: Could not unload daemon: ' + err.message);

      // Proceed with activation even if unload failed
      setUpVersion('this', function(err) {
        if (err) return cb(err);

        // Clean up old versions after successful activation
        cleanup_old_versions(function() {
          // Reload daemon after activation and cleanup
          log('Reloading daemon after activation...');
          exec(`launchctl load /Library/LaunchDaemons/${daemon_key}.plist`, function(err) {
            if (err) log('Warning: Could not reload daemon: ' + err.message);
            cb(err);
          });
        });
      });
    });
  } else {
    setUpVersion('this', cb);
  }
};

exports.post_install = (values, cb) => {
  const ready = (err) => {
    if (err) return cb(err);

    const tasks = [
      daemon.install,
      osHooks.post_install,
      clear_folders.start,
      clear_files_temp.start
    ];

    log('Installing init scripts.');
    async.series(tasks, (err) => {

      if (err) 
        return cb(err);
      const finished = () => {
        log('Sweet! Please run `prey config panel` to link your device.');
        return cb && cb();
      };

      if (is_mac) 
        daemon.set_watcher(finished);
      else 
        finished();
    });
  };

  if (process.platform == 'win32') 
    setUpVersion('this', ready);

  prey_user.create(ready);
};



exports.pre_uninstall = (values, cb) => {
  const argument = values['-u'] && values.positional[0];
  const updating = argument == 'true' || parseInt(argument) === 1;

  const tasks = [daemon.remove, osHooks.pre_uninstall];

  if (is_mac)
    tasks.unshift(prey_owl.remove_watcher);

  if (!updating) {
    if (isWindows) {
      tasks.push(osHooks.deletePreyFenix);
    }
    tasks.push(osHooks.deleteOsquery);
    const api_key = shared.keys.get().api;
    const device_key = shared.keys.get().device;
    if (api_key && device_key) {
      api.keys.set({ api: api_key, device: device_key });
      api.push.event({ name: 'uninstalled' }, { json: true });
    }
  }

  async.series(tasks, (err) => cb(err));
};