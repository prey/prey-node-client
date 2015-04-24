var setup    = require('./setup'),
    sender   = require('./sender'),
    api      = require('./api'),
    prompt   = require('./prompt'),
    bus      = require('./bus');

var adapters = {
    interval : require('./interval'),
    push     : require('./push')
}

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

var wait_for_config = function() {
  logger.warn('Not configured. Waiting for user input...');
  var attempts = 0;

  var timer = setInterval(function() {

    logger.info('Reloading config...');
    config.reload();

    if (config.get('api_key') && config.get('device_key')) {

      clearInterval(timer);
      // set the new keys in the api before booting
      init_api(config.all(), function() { boot() });

    } else if (++attempts > 30) { // five mins total
      throw new Error('Not configured. Stopping.');
    }

  }, 10000); // 10 seconds
}

function boot(cb) {
  load_hooks();
  sync();
  load_adapter('interval');
  load_adapter('push', function(err) {
    if (err) hooks.trigger('error', err);
    cb && cb();
  })
}

function load_hooks() {
  // main agent hooks
  hooks.on('action',   sender.notify_action)
  hooks.on('event',    sender.notify_event)
  hooks.on('data',     sender.send_data)
  hooks.on('report',   sender.send_report)

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

function sync() {
  api.devices.get.status(function(err, response) {
    var result = response && response.body;

    if (!result || (response && response.statusCode > 300))
      return logger.warn('Unable to sync settings.');

    if (err)
      return setTimeout(sync, 10000);

    if (result.settings)
      update_settings(result.settings);

    if (result.status && result.status.missing == true)
      missing(result.status.delay);

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

function scan_hardware() {
  commands.run('get', 'specs');
}

function load_adapter(name, cb) {
  adapters[name].load.call(common, function(err, emitter){
    cb && cb(err);

    if (!emitter) return;
    emitter.on('woken', adapters.interval.check);
    emitter.on('command', commands.perform);
  });
}

function missing(interval) {
  logger.info('Holy mother of satan! Device seems to be missing!');
  var interval = interval || 20;
  commands.run('report', 'stolen', { interval: interval });
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

  setup.start(common, function(err) {
    if (!err)
      return boot(cb);

    if (!common.helpers.running_on_background())
      cb && cb(err); // throw err;
    else
      wait_for_config();
  })
}

exports.unload = function(cb) {
  unload_hooks();
  adapters.interval.unload.call(common);
  adapters.push.unload.call(common, cb);
}

// export API for conf module
exports.load_api = function(opts, cb) {
  init_api(opts, cb);
  return api;
};
