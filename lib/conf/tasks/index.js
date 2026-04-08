const fs = require('fs');
const async = require('async');
const client = require('needle');
const shared = require('../shared');
const common = require('../../common');

const { paths } = common.system;
const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const is_mac = osName == 'mac';
const chmodr = require('chmodr');
const prey_owl = require('./prey_owl');
const api = require('../../agent/control-panel/api');

const isWindows = osName === 'windows';
exports.chmodr = chmodr;

const host = 'https://127.0.0.1:7739';
const osHooks = require(`./os/${osName}`);
const daemon = require('./daemon');
const prey_user = require('./prey_user');
const clear_folders = require('./clear_folders');
const clear_files_temp = require('./clear_files_prey_temp');

const log = (str) => shared.log(str);

const debug_log_path = '/tmp/prey_upgrade_debug.log';
function debug_log(msg) {
  try {
    const now = new Date();
    const ts = now.toISOString().replace('T', ' ').replace('Z', '');
    fs.appendFileSync(debug_log_path, `[${ts}] [tasks/index] ${msg}\n`);
  } catch (e) {}
}

const ensure_dir = (dir, cb) => {
  const exists = fs.existsSync(dir);
  if (exists) return cb();
  fs.mkdir(dir, cb);
};

const setUpConfig = function (cb) {
  log(`Ensuring presence of config dir: ${paths.config}`);
  ensure_dir(paths.config, (err) => {
    if (err) return cb(err);
    cb();
    // log(`Syncing ${common.config.path} with ${common.default_config_file}`);
    // common.config.sync(common.default_config_file, 'nonempty', cb);
  });
};

const setUpVersion = function (version, cb) {
  debug_log(`setUpVersion() called with version=${version}`);
  debug_log(`  UPGRADING_FROM=${process.env.UPGRADING_FROM || '(not set)'}`);
  debug_log(`  paths.current=${paths.current}, paths.versions=${paths.versions}`);

  const finish = () => {
    log(`Setting permissions on ${paths.current}`);
    debug_log(`  chmodr START on ${paths.current}`);
    const chmodr_start = Date.now();
    exports.chmodr(paths.current, 0o755, (err) => {
      const chmodr_dur = Date.now() - chmodr_start;
      debug_log(`  chmodr DONE in ${chmodr_dur}ms${err ? `, error=${err.message}` : ''}`);
      if (err) return cb(err);

      debug_log(`  client.put START to ${host}`);
      const put_start = Date.now();
      client.put(host, null, { timeout: 4500 }, (put_err, put_resp) => {
        const put_dur = Date.now() - put_start;
        debug_log(`  client.put DONE in ${put_dur}ms${put_err ? `, error=${put_err.message}` : `, status=${put_resp && put_resp.statusCode}`}`);
        log('Running post_activate hooks...');
        debug_log('  post_activate START');
        osHooks.post_activate((pa_err) => {
          debug_log(`  post_activate DONE${pa_err ? `, error=${pa_err.message}` : ''}`);
          cb(pa_err);
        });
      });
    });
  };

  setUpConfig((err) => {
    if (err) {
      debug_log(`  setUpConfig failed: ${err.message}`);
      return cb(err);
    }

    if (!paths.versions) {
      log('No versions support.');
      debug_log('  No versions support, calling finish()');
      return finish();
    }

    log(`Setting up ${version} as current...`);
    debug_log('  set_current START');
    const sc_start = Date.now();
    shared.version_manager.set_current(version, (err) => {
      const sc_dur = Date.now() - sc_start;
      if (err) {
        if (err.code == 'ALREADY_CURRENT') {
          log('Warning: This version is already set as current.');
          debug_log(`  set_current DONE in ${sc_dur}ms: ALREADY_CURRENT`);
        } else {
          debug_log(`  set_current FAILED in ${sc_dur}ms: ${err.message}`);
          return cb(err);
        }
      } else {
        debug_log(`  set_current DONE in ${sc_dur}ms: success`);
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
      clear_files_temp.start,
    ];

    log('Installing init scripts.');
    async.series(tasks, (err) => {
      if (err) { return cb(err); }
      const finished = () => {
        log('Sweet! Please run `prey config panel` to link your device.');
        return cb && cb();
      };

      if (is_mac) { daemon.set_watcher(finished); } else { finished(); }
    });
  };

  if (process.platform == 'win32') { setUpVersion('this', ready); }

  prey_user.create(ready);
};

exports.pre_uninstall = (values, cb) => {
  const argument = values['-u'] && values.positional[0];
  const updating = argument == 'true' || parseInt(argument) === 1;

  const tasks = [daemon.remove, osHooks.pre_uninstall];

  if (is_mac) tasks.unshift(prey_owl.remove_watcher);

  if (!updating) {
    if (isWindows) {
      tasks.push(osHooks.deletePreyFenix);
    }
    tasks.push(osHooks.deleteOsquery);
    if (isWindows) {
      // Keep MSI uninstall orchestration outside this hook to avoid recursive uninstall loops.
      tasks.push(osHooks.deep_cleanup);
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
