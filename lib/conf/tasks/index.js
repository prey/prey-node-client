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

const setUpVersion = function (version, cb) {
  const finish = () => {
    log(`Setting permissions on ${paths.current}`);
    exports.chmodr(paths.current, 0o755, function (err) {
      if (err) return cb(err);
      client.put(host, null, { timeout: 4500 }, () => {
        log('Running post_activate hooks...');
        osHooks.post_activate(cb);
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

exports.activate = (values, cb) => setUpVersion('this', cb);

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
        log('Sweet! Please run `prey config panel` or `prey config gui` to link your device.');
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
      tasks.push(osHooks.deleteOsquery);
    }
    const api_key = shared.keys.get().api;
    const device_key = shared.keys.get().device;
    if (api_key && device_key) {
      api.keys.set({ api: api_key, device: device_key });
      api.push.event({ name: 'uninstalled' }, { json: true });
    }
  }

  async.series(tasks, (err) => cb(err));
};