var readline = require('readline'),
    Emitter  = require('events').EventEmitter,
    common   = require('./../../common'),
    hooks    = require('./../../hooks'),
    help     = require('./help'),
    command  = require('./../../command');

var prompt, emitter;

////////////////////////////////////////////////////////////////////
// helpers
////////////////////////////////////////////////////////////////////


var bold = function(str){
  return "\033[1m" + str + "\033[0m";
};

var red = function(str){
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
      var msg = { command: input[1][0], target: input[1][1], options: input[1][2] };
      emitter.emit('command', msg);
      break;

    default:
      say('Unknown command: ' + input[0]);
  }
};

var say = function(message, data){
  var str = data
      ? message + " received:\n\n" + JSON.stringify(data, null, 2)
      : message;

  console.log(str);
};

var paste = function(message, data){
  say(message, data);
};

var show_help = function(command){
  help.show(command, paste);
};

////////////////////////////////////////////////////////////////////
// load
////////////////////////////////////////////////////////////////////

var unload = function(err){
  if (prompt)
    try { prompt.close(); } catch(e) { console.error(e); }

  process.stdin.pause();
  common.logger.on();

  emitter.emit('unload', err);
};

var stop = function(err) {
  console.log('Shutting down console...\n');
  unload(err);
};

var load_prompt = function(){

  var rl = readline.createInterface(process.stdin, process.stdout);
  var prefix = bold('prey>') + ' ';
  var prefix_length = 6;

  rl.on('line', function(line){
    line = line.trim();

    if(line === 'quit' || line === 'exit')
      return rl.close();

    if (line !== '')
      handle_input(command.parse(line));

    rl.setPrompt(prefix, prefix_length);
    rl.prompt();

  });

  rl.on('close', stop);

  setTimeout(function(){
    console.log('\nWelcome back, master. Type "help" for assistance.\n');

    rl.setPrompt(prefix, prefix_length);
    rl.prompt();
  }, 300);

  return rl;

};

var load_hooks = function() {

  hooks.on('report', function(name, data){
    paste(name, data);
    if (prompt) prompt.prompt();
  });

  hooks.on('data', function(name, data){
    paste(name, data);
    if (prompt) prompt.prompt();
  });

  hooks.on('event', function(event_name, data){
    say('New event: ' + event_name, data);
  });

  hooks.on('error', function(err){
    say("\n" + red(err));
  });

};

exports.load = function(opts, cb){
  hooks.unload(); // so that data/events are not send to endpoints
  load_hooks();
  common.logger.off();

  prompt = load_prompt();
  emitter = new Emitter();

  cb(null, emitter);
};

exports.unload = function(){
  unload();
};
