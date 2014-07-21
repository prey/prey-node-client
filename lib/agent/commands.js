exports.parse = function() {

}

exports.perform = function(command) {
  var methods = {
    'start'   : actions.start,
    'stop'    : actions.stop,
    'watch'   : triggers.add,
    'unwatch' : actions.stop,
    'get'     : providers.get,
    'report'  : reports.get,
    'cancel'  : reports.cancel,
    'driver'  : load_driver,
    'upgrade' : updater.check
  }

  var method = methods[command.command] || methods[command.name];

  if (method)
    method(command.target, command.options);
  else
    handle_error(new Error('Unknown command: ' + (command.command || command.name)))
}

exports.process = function(str) {
  try {
    var commands = JSON.parse(str);
    logger.info('Got commands.');
  } catch(e) {
    return handle_error(new Error('Invalid commands: ' + str));
  }

  commands.forEach(perform_command);
}