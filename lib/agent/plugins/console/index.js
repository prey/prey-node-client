var readline  = require('readline'),
    Emitter   = require('events').EventEmitter,
    help      = require('./help'),
    completer = require('./completer');

var agent, prompt, emitter;

////////////////////////////////////////////////////////////////////
// helpers
////////////////////////////////////////////////////////////////////

var bold = function(str) {
  return "\033[1m" + str + "\033[0m";
};

var red = function(str) {
  return "\033[1;31m" + str + "\033[0m";
};

////////////////////////////////////////////////////////////////////
// messages
////////////////////////////////////////////////////////////////////

var handle_input = function(input) {
  if (!input)
    return show_help();

  switch (input[0]) {

    case 'help':
      show_help(input[1])
      break;

    case 'command':
      agent.commands.perform(input[1]);
      break;

    default:
      say('Unknown command: ' + input[0]);
  }
};

var say = function(message, data) {
  var str = data
      ? message + " received:\n\n" + JSON.stringify(data, null, 2)
      : message;
  console.log(str);
};

var paste = function(message, data) {
  say(message, data);
};

var show_help = function(command) {
  help.show(command, paste);
};

////////////////////////////////////////////////////////////////////
// load
////////////////////////////////////////////////////////////////////

var load_prompt = function(){

  var rl = readline.createInterface(process.stdin, process.stdout, completer);
  var prefix = bold('prey>') + ' ';
  var prefix_length = 6;

  rl.on('line', function(line) {
    line = line.trim();

    if(line === 'quit' || line === 'exit')
      return rl.close();

    if (line !== '')
      handle_input(agent.commands.parse(line));

    rl.setPrompt(prefix, prefix_length);
    rl.prompt();
  });

  rl.on('close', stop);

  setTimeout(function() {
    console.log('\nWelcome back, master. Type "help" for assistance.\n');

    rl.setPrompt(prefix, prefix_length);
    rl.prompt();
  }, 300);

  return rl;

};

var load_hooks = function() {

  agent.hooks.on('report', function(name, data) {
    paste(name, data);
    if (prompt) prompt.prompt();
  });

  agent.hooks.on('data', function(name, data) {
    paste(name, data);
    if (prompt) prompt.prompt();
  });

  agent.hooks.on('action', function(status, name, err) {
    say('\nAction ' + bold(name) + ' has ' + bold(status) + '.');
  });

  agent.hooks.on('event', function(event_name, data) {
    say('New event: ' + event_name, data);
  });

  agent.hooks.on('error', function(err) {
    say("\n" + red(err));
  });

};

exports.enabled = function(cb) {
  cb(new Error('This plugin is not used this way. To use it, run `bin/prey console`.'));
}

var unload = function(err) {
  if (prompt)
    try { prompt.close(); } catch(e) { console.error(e); }

  process.stdin.pause();
  agent.logger.resume();
};

var stop = function(err) {
  console.log('Shutting down console...\n');
  unload(err);
};

exports.load = function() {
  agent = this;

  if (!agent.program.debug) agent.logger.pause();
  // agent.hooks.unload(); // so that data/events are not send to endpoints
  load_hooks();

  prompt = load_prompt();
};

exports.unload = function(){
  unload();
};
