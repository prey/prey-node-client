var setup    = require('./setup'),
    interval = require('./interval'),
    push     = require('./push'),
    sender   = require('./sender'),
    api      = require('./api'),
    prompt   = require('./prompt');

var common,
    logger,
    hooks;

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
  load_hooks()
  sync()
  check_in()
  listen(cb)
}

function load_hooks() {
  hooks.on('action',   sender.notify_action)
  hooks.on('event',    sender.notify_event)
  hooks.on('data',     sender.send_data)
  hooks.on('report',   sender.send_report)
  hooks.on('response', handle_response)
}

function handle_response(what, resp) {
  if (what == 'reports' && resp.statusCode > 300)
    found();
  else if (resp.headers['X-Prey-Commands'])
    commands.process(resp.body);
}

function sync() {
  api.devices.get.status(function(err, result) {
    if (err)
      return setTimeout(sync, 10000);

    if (result.settings)
      config.update(result.settings)

    if (result.status == 'missing')
      missing()
  })
}

function check_in() {
  interval.load.call(common);
}

function listen(cb) {
  push.load.call(common, cb);
}

function missing(interval) {
  var interval = interval || 20;
  commands.perform(commands.build('report', 'missing', { interval: interval }));
}

function found() {
  commands.perform(commands.build('cancel', 'missing'))
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

  setup(common, function(err) {
    if (err)
      return handle_setup_error(err, cb);

    sender.init(common);
    boot(function(err) {
      if (err) hooks.trigger('error', err);

      cb();
    });
  })
}

exports.unload = function(cb) {
  interval.unload.call(common);
  push.unload.call(common, cb);
}

// export API for conf module
exports.api = api;
