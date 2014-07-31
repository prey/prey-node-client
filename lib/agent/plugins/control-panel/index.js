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

var handle_setup_error = function(err, cb) {
  if (!common.helpers.running_on_background())
    cb(err); // throw err;
  else
    wait_for_config();
}

var wait_for_config = function() {
  logger.info('Not configured. Waiting for user input...')
  var attempts = 0;

  var timer = setInterval(function(){
    logger.info('Reloading config...');
    config.reload();

    if (config.get('api_key')) {
      clearInterval(timer);
      boot()
    } else if (++attempts > 12) { // two mins total
      throw new Error('Not configured. Stopping.');
    }
  }, 10000);
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
  hooks.on('action',   sender.notify_action)
  hooks.on('event',    sender.notify_event)
  hooks.on('data',     sender.send_data)
  hooks.on('report',   sender.send_report)

  // this is triggered from this own plugin's sender module
  bus.on('response', handle_response)
}

function handle_response(what, err, resp) {
  if (what == 'report' && resp.statusCode > 300)
    found();
  else if (resp.headers['X-Prey-Commands'])
    commands.process(resp.body);
}

function sync() {
  api.devices.get.status(function(err, result) {
    if (result && result.statusCode > 300)
      return;

    if (err)
      return setTimeout(sync, 10000);

    if (result.settings)
      config.update(result.settings)

    if (result.status == 'missing')
      missing()
  })
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
  commands.perform(commands.build('report', 'stolen', { interval: interval }));
}

function found() {
  logger.info('Device no longer missing.');
  commands.perform(commands.build('cancel', 'stolen'))
}

/////// exports

exports.setup = function(cb) {
  // we need to comment this out, as it prevents the 'config account setup --force'
  // option to work. normally this plugin will not be enabled via 'config plugins enable foo'
  // so let's just leave it out for now. plugin fiddlers can manage. :)

  // if (this.config.get('api_key'))
  // return cb();

  prompt.start(function(err, key) {
    if (err) return cb(err);

    cb(null, { api_key: key });
  })
}

exports.enabled = function(cb) {
  setup(this, cb);
}

exports.disabled = function(cb) {
  api.devices.unlink(function(err) {
    var success = !err || (err.code == 'MISSING_KEY' || err.code == 'INVALID_CREDENTIALS');
    if (!success)
      return cb(err);

    config.set('api_key', '');
    config.set('device_key', '');
    config.save(cb);
  })
}

exports.load = function(cb) {
  common   = this;
  hooks    = common.hooks;
  logger   = common.logger;
  config   = common.config;
  commands = common.commands;

  sender.init(common);

  setup(common, function(err) {
    if (err)
      return handle_setup_error(err, cb);

    boot(cb);
  })
}

exports.unload = function(cb) {
  adapters.interval.unload.call(common);
  adapters.push.unload.call(common, cb);
}

// export API for conf module
exports.api = api;
