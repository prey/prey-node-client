var setup    = require('./setup'),
    sender   = require('./sender'),
    secure   = require('./secure'),
    api      = require('./api'),
    prompt   = require('./prompt'),
    bus      = require('./bus'),
    reports  = require('./../../reports'),
    hardware = require('./../../providers/hardware'), 
    long_polling = require('./long-polling'),
    lp_conf      = require('./../../../conf/long-polling'),
    os_name      = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    join         = require('path').join,
    system       = require(join('./../../../system', os_name));

var common,
    hooks,
    logger,
    config,
    commands;

var init_api = function(opts, cb) {
  if (!opts)
    return cb && cb(new Error('Invalid config.'));

  api.use({
    host          : opts.host,
    protocol      : opts.protocol,
    try_proxy     : opts.try_proxy
  });

  if (!cb) return;

  // if a callback was passed, then the called
  // expects the keys to be set as well.
  api.keys.set({
    api: opts.api_key,
    device: opts.device_key
  }, cb);
}

var wait_for_config = function(cb) {
  logger.warn('Not configured. Waiting for user input...');
  var attempts = 0;

  var timer = setInterval(function() {

    logger.info('Reloading config...');
    config.reload();

    if (config.get('api_key') && config.get('device_key')) {

      clearInterval(timer);
      // set the new keys in the api before booting
      init_api(config.all(), function() { boot(cb) });

    } else if (++attempts > 30) { // five mins total
      throw new Error('Not configured. Stopping.');
    }

  }, 10000); // 10 seconds
}

//exports.timeout =  1 * 60 * 1000   // Every 1 minutes
exports.timeout = 2 * 60 * 60 * 1000;  // Every 2 hours
function boot(cb) {
  load_hooks();
  sync();
  
  var status_interval = setInterval(() => {
    send_info_encrypt();
  },exports.timeout)
  
  long_polling.load.call(common, function(err, emitter) {
    if (!emitter) return;
    emitter.on('command', commands.perform);
  });
  cb && cb();
}

function load_hooks() {
  // main agent hooks
  hooks.on('action',   sender.notify_action)
  hooks.on('event',    sender.notify_event)
  hooks.on('data',     sender.send_data)
  hooks.on('report',   (name, data) => {
    let data_to_send_panel  = {
        ...data
    }
    if (name == 'specs') hardware.track_hardware_changes(data);
    sender.send_report(name, data_to_send_panel)
  });

  // this is triggered from this own plugin's sender module
  bus.on('response', handle_response)
}

function unload_hooks() {
  hooks.remove('action',   sender.notify_action)
  hooks.remove('event',    sender.notify_event)
  hooks.remove('data',     sender.send_data)
  hooks.remove('report',   sender.send_report)

  bus.removeListener('response', handle_response)
}

function handle_response(what, err, resp) {
  if (what == 'report' && (resp && resp.statusCode == 409))
    found();
  else if (resp && resp.headers['X-Prey-Commands'])
    commands.process(resp.body);
}

var compatible_with_module_tpm = function (data) {
  var editions = ["Pro", "Education", "Enterprise"];
  var gte      = common.helpers.is_greater_or_equal;

  if (os_name == 'windows' && gte(system.os_release, "10.0.0") &&
      data.os_edition && editions.includes(data.os_edition)    &&
      data.winsvc_version && gte(data.winsvc_version, "2.0.0"))
        return true;
  return false;
}

function send_info_encrypt(params,cb) {
  let data = {};
  if(os_name == 'windows'){
    system.get_os_edition(function(err, os_edition) {
      if (err) return new Error('Error to get os_edition informaton');
      data.os_edition = os_edition;
      system.get_winsvc_version(function(err, winsvc_version) {
        if (err) return new Error('Error to get winsvc_version informaton');
        data.winsvc_version = winsvc_version;
        if (config.get('api_key') && config.get('device_key') && (compatible_with_module_tpm(data))) {
            commands.run('get', 'encryption_status');
            commands.run('get', 'encryption_keys');
        }
      })
    })
  }
}

function sync() {
  api.devices.get.status(function(err, response) {
    var result = response && response.body;
 
    if (!result || (response && response.statusCode > 300))
      return logger.warn('Unable to sync settings.');

    if (err)
      return setTimeout(sync, 10000);

    if (result.settings)
      update_settings(result.settings);

    // Check if it's already stolen before mark as missing again
    var is_stolen = reports.running().some(e => e.name == 'stolen');
    if (result.status && result.status.missing === true && !is_stolen) {
      var opts = {
        interval: result.status.delay || 20,
        exclude: result.status.exclude
      };

      missing(opts);
    }

    if (result.running_actions && result.running_actions.length > 1) {
      logger.warn('Restarting ' + result.running_actions.length + ' actions!');
      result.running_actions.forEach(commands.perform);
    }

    if (config.get('scan_hardware'))
      scan_hardware();
  })
}

function update_settings(obj) {
  logger.debug('Syncing settings.');

  function process(values, target) {
    for (var key in values) {
      // only set value if present and different from current
      if (values[key] == null) values[key] = false;
      if (typeof values[key] != 'undefined' && target.get(key) !== values[key]) {
        logger.notice('Updating value of ' + key + ' to ' + values[key]);
        target.set(key, values[key])
      }
    }
    target.save();
  }

  if (obj.global)
    process(obj.global, common.config.global);

  if (obj.local)
    process(obj.local, common.config);
}

function missing(opts) {
  logger.info('Holy mother of satan! Device seems to be missing!');
  commands.run('report', 'stolen', opts);
}

function scan_hardware() {
 commands.run('get', 'specs');
}

function found() {
  logger.info('Device no longer missing.');
  commands.run('cancel', 'stolen');
}

/////// exports

exports.setup = function(cb) {
  // we need to comment this out, as it prevents the 'config account setup --force'
  // option to work. normally this plugin will not be enabled via 'config plugins enable foo'
  // so let's just leave it out for now. plugin fiddlers can manage. :)

  // if (this.config.get('api_key'))
  // return cb();

  init_api(this.config.all());
  prompt.start(function(err, key) {
    if (err) return cb(err);

    cb(null, { api_key: key });
  })
}

// called from conf module after plugin is setup
// calls setup to ensure device is linked.
exports.enabled = function(cb) {
  init_api(this.config.all());
  setup.start(this, cb);
}

// called when plugin is disabled, either via the plugin manager
// or when the running the pre_uninstall hooks.
exports.disabled = function(cb) {
  var config = this.config;

  init_api(this.config.all(), function(err) {
    if (err) return cb(); // keys are missing, so just return

    api.devices.unlink(function(err) {
      // only return if we had a non-key related error
      var failed = err && (err.code != 'MISSING_KEY' && err.code != 'INVALID_CREDENTIALS');
      if (failed)
        return cb(err);

      // ok, so device was unlinked. let's clear the device key but NOT
      // the API key. that way, if we're upgrading via a package manager
      // (e.g. apt-get) we don't lose scope of the user's account API key.
      // so whenever the post_install hooks are called and the agent is
      // called, it will automatically relink the device to the account.

      // config.set('api_key', '');
      config.set('device_key', '');
      config.save(cb);
    });
  });
}

exports.load = function(cb) {
  common   = this;
  hooks    = common.hooks;
  logger   = common.logger;
  config   = common.config;
  commands = common.commands;

  if (!config)
    return cb && cb(new Error('No config object.'));

  init_opts = common.config.all();
  init_opts.try_proxy = common.config.global.get('try_proxy');

  init_api(init_opts);
  sender.init(common);

  secure.generate_keys(function(err) {
    if (err) logger.warn(err.message);
    setup.start(common, function(err) {
      if (!err)
        return boot(cb);

      if (!common.helpers.running_on_background())
        cb && cb(err); // throw err;
      else {
        lp_conf.load(function() {
          wait_for_config(cb);
        })
      }
    })
  })
}

exports.unload = function(cb) {
  unload_hooks();
  long_polling.unload.call(common, cb);
}

// export API for conf module
exports.load_api = function(opts, cb) {
  init_api(opts, cb);
  return api;
};

exports.get_setting = function(key) {
  return common.config.get(key);
};

exports.update_setting = function(key, value) {
  if (typeof value != 'undefined' && common.config.get(key) !== value) {
    logger.notice('Updating value of ' + key + ' to ' + value);
    common.config.set(key, value);
  }
  common.config.save();
};
