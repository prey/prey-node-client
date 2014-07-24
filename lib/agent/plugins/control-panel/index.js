var setup    = require('./setup'),
    interval = require('./interval'),
    push     = require('./push'),
    sender   = require('./sender'),
    api      = require('./api'),
    prompt   = require('./prompt');

var agent,
    logger,
    hooks;

var handle_setup_error = function(err, cb) {
  if (!agent.helpers.running_on_background())
    cb(err); // throw err;
  else
    wait_for_config();
}

var wait_for_config = function() {
  logger.info('Not configured. Waiting for user input...')
  var attempts = 0;

  var timer = setInterval(function(){
    logger.info('Reloading config...');
    agent.config.reload();

    if (agent.config.get('api_key')) {
      clearInterval(timer);
      boot()
    } else if (++attempts > 12) { // two mins total
      throw new Error('Not configured. Stopping.');
    }
  }, 10000);
}

function boot() {
  load_hooks()
  sync()
  check_in()
  listen()
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
    recovered();
  else if (resp.headers['X-Prey-Commands'])
    commands.process(resp.body);
}

function sync() {
  api.devices.get.status(function(err, result) {
    if (err)
      return setTimeout(sync, 10000);

    if (result.settings)
      agent.config.update(result.settings)

    if (result.status == 'missing')
      missing()
  })
}

function check_in() {
  interval.load(agent);
}

function listen() {
  push.load(agent);
}

function missing(interval) {
  var interval = interval || 20;
  agent.commands.perform('report', 'missing', { interval: interval })
}

function recovered() {
  agent.commands.perform('cancel', 'missing')
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

exports.added = function(cb) {
  setup(this, cb);
}

exports.removed = function(cb) {
  agent = this;

  api.devices.unlink(function(err) {
    var success = !err || (err.code == 'MISSING_KEY' || err.code == 'INVALID_CREDENTIALS');
    if (!success)
      return cb(err);

    agent.config.set('api_key', '');
    agent.config.set('device_key', '');
    agent.config.save(cb);
  })
}

exports.load = function(cb) {
  agent  = this;
  hooks  = agent.hooks;
  logger = agent.logger;

  setup(agent, function(err) {
    if (err)
      return handle_setup_error(err, cb);

    sender.init(agent);
    boot();
    cb();
  })
}

exports.unload = function(cb) {
  commands.unload()
  push.unload(cb)
}

// export API for conf module
exports.api = api;
