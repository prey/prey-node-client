var setup    = require('./setup'),
    interval = require('./interval'),
    push     = require('./push'),
    sender   = require('./sender'),
    api      = require('./api');

var agent,
    logger,
    hooks;

var handle_setup_error = function(err) {
  if (!agent.helpers.running_on_background())
    throw err;
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

function listen() {
  push.load(agent, function(err) {
    if (err) hooks.trigger('error', err);

    // interval.quick()
  });
}

function check_in() {
  interval.load(agent);
}

function missing(interval) {
  var interval = interval || 20;
  agent.commands.perform('report', 'mising', { interval: interval })
}

function recovered() {
  agent.commands.perform('cancel', 'mising')
}

exports.load = function(common, cb) {
  agent  = common;
  hooks  = agent.hooks;
  logger = agent.logger;
  agent.api = api;

  setup(agent, function(err) {
    if (err) return handle_setup_error(err);

    boot()    
  })
}

exports.unload = function(cb) {
  commands.unload()
  push.unload()
}

exports.setup = setup;
exports.api   = api;