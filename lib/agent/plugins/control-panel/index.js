var setup    = require('./setup'),
    commands = require('./interval'),
    push     = require('./push'),
    sender   = require('./sender'),
    api      = require('./../../../api');

var agent,
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
    reports.cancel_all();
  else if (resp.headers['X-Prey-Commands'])
    process_message(resp.body);
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
  push.load(agent, function(err, listener) {
    listener.on('woken', wake)
    listener.on('commands', got_commands)
  })
}

function check_in() {
  commands.load(agent, function(err, listener) {
    listener.on('commands', got_commands)
  });
}

function wake() {
  hooks.emit('woken')
}

function got_commands(commands) {
  hooks.emit('commands', commands)
}

function missing() {
  reports.get('missing', function(err, data) {
    device.reports.send(data);
  })
}

function recovered() {
  reports.stop()
}

exports.load = function(common, cb) {
  agent = common;
  hooks = agent.hooks;
  agent.api = api;

  setup(agent, function(err) {
    if (err) return handle_setup_error();

    boot()    
  })
}

exports.unload = function(cb) {
  commands.unload()
  push.unload()
}