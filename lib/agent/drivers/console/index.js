// strict mode off here, as it throws when processing the octal codes
//"use strict";

//////////////////////////////////////////
// Prey Console Driver
// Written by Tomas Pollak
// (c) 2011, Fork Ltd. http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var util       = require('util'),
    readline   = require('readline'),
    Emitter    = require('events').EventEmitter,
    common     = require('./../../common'),
    hooks      = require('./../../hooks'),
    triggers   = require('./../../triggers'),
    dispatcher = require('./../../dispatcher'),
    parser     = require('./message_parser').parse,
    help       = require('./help'),
    logger     = common.logger;

// Use completions from help.js where line starts with a space or tab.
function completer(line, callback) {
  var debug = common.program.debug; // for testing
  var completions = [
    'config ',
    'get ',
    'send ',
    'watch ',
    'unwatch ',
    'start ',
    'stop ',
    'on ',
    'help ',
    'quit'
  ];
  var hits = [];
  var partialLine = line;
  var words = line.split(/\s+/);
  var cmd = words[0];
  if (cmd === 'help') {
    partialLine = words[words.length-1];
  } else if (words.length > 1) { 
    // might need more advanced matchers for `on` and `send`.
    help.show(cmd, function(str) {
      if (debug) console.log("---", JSON.stringify(str), "---", typeof str);
      var trimm = function(it) { return it.trim() + " "; }
      // Use each "help" line starting with a tab or space.
      completions = str.split("\n").filter(function(it) { return it.match(/^\s+\w+/); }).map(trimm);
      partialLine = words[words.length-1] || line;
      if ("send" === cmd || "on" === cmd) {
        completions.push("to ", "imgur ", "using ");
      }  else if ("config" === cmd) {
        completions.push("read ", "update ");
      }
      //~ completions.sort();
      if (debug) console.log(partialLine, completions, completions[completions.length-1].indexOf(partialLine));
      hits = completions.filter(function(c) { return c.indexOf(partialLine) == 0 });
      //~ if (debug) console.log("#", partialLine, completions.length, typeof hits, hits);
      // show all completions if none found
      callback(null, [hits && hits.length ? hits : completions, partialLine]);
    }); 
    return; // don't call callback twice
  }
  hits = completions.filter(function(c) { return c.indexOf(partialLine) == 0 });
  // show all completions if none found
  callback(null, [hits && hits.length ? hits : completions, partialLine]);
  return; // [hits && hits.length ? hits : completions, partialLine]
}

var ConsoleDriver = function(options){

  var self = this;
  var options = options || {};

  this.destinations = {};
  this.combos = {};
  this.running = [];
  this.options = options;

  this.email_regex = /^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/;
  this.host_regex = /[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,3}/;

  this.load = function(callback){
    this.load_prompt();
    this.load_hooks();
    callback(null, self);
    if (!common.program.debug) common.logger.off();
  };

  this.bold = function(str){
    return "\033[1m" + str + "\033[0m";
  };

  this.red = function(str){
    return "\033[1;31m" + str + "\033[0m";
  };

  this.remove_from_running = function(action_name){
    this.running.splice(this.running.indexOf(action_name), 1);
  };

  this.load_prompt = function(){

    var rl = this.prompt = readline.createInterface(process.stdin, process.stdout, completer);
    var prefix = this.bold('prey>') + ' ';
    var prefix_length = 6;

    rl.on('line', function(line){
      line = line.trim();

      if(line === 'quit' || line === 'exit')
        return rl.close();

      if(line !== '')
        self.parse_message(line);

      rl.setPrompt(prefix, prefix_length);
      rl.prompt();

    });

    rl.on('close', function() {
      self.stop();
    });

    setTimeout(function(){
      console.log('\nWelcome back, master. Type "help" for assistance.\n');

      rl.setPrompt(prefix, prefix_length);
      rl.prompt();
    }, 300);

  };

  this.load_hooks = function(){

    hooks.on('data', function(name, data){
      if(self.destinations[name]) // if we were asked for another destination
        self.post(name, data);
      else
        self.paste(name, data);

      if(self.prompt) self.prompt.prompt();
    });

    hooks.on('err', function(err){
      self.say("\n" + self.red(err));
    });

    hooks.on('event', function(event_name, data){

      if (event_name == 'action_finished')
        self.remove_from_running(data);

      if (data && data.stack) // error
        return self.say(data.toString());
      else // if (!event_name.match('actions_'))
        self.say("New event: " + event_name, data);

      if(self.combos[event_name])
        self.parse_message(self.combos[event_name], true);

      delete self.combos[event_name];
    });

  };

  this.stop = function(){
    console.log('\nShutting down Prey console...\n');
    this.unload();
  };

  this.unload = function(err){
    if (err) logger.error(err);

    if (this.prompt)
      try { this.prompt.close(); } catch(e) { console.error(e); }

    process.stdin.pause();
    hooks.removeAllListeners();
    common.logger.on();

    this.running.forEach(function(action){
      self.emit('stop', action);
    });

    this.emit('unload', err);
  };

  this.say = function(message, data){
    var str = data
        ? message + " received:\n\n" + JSON.stringify(data, null, 2)
        : message;

    console.log(str);
  };

  this.paste = function(message, data){
    this.say(message, data);
  };

  this.show_help = function(command){
    help.show(command, function(str) {
      self.paste(str);
    });
  };

  this.send_file = function(file){
    this.post(file, {file: file, content_type: 'application/octet-stream'});
  };

  this.get_config = function(key){
    var value = common.config.get(key);
    if(typeof value !== 'undefined')
      this.say('config: ' + key, value);
    else
      this.say("Error: Invalid config key: " + key);
  };

  this.post = function(name, data){

    var destination = this.destinations[name];
    this.say("Sending " + name + " to " + destination.to + "...");

    if (typeof data === 'string'){
      var post_data = {};
      post_data[name] = data;
      data = post_data;
    } else if (data.file && data.content_type) {
      data = {
        file: {file: data.file, content_type: data.content_type}
      };
    }

    var callback = function(err, response_data){
      if (err) return self.say("Unable to send data: " + err.toString());

      if (response_data.subject) // email
        self.say("Email successfully sent. Check your inbox. :)");
      else
        self.paste(response_data);
    };

    var merge_opts = function(key){
      var opts = destination.options || {};
      if(key) opts[key] = destination.to;
      return opts;
    };

    if (destination.to === 'imgur')
      dispatcher.send('imgur', data, merge_opts(), callback);
    else if (destination.to.match(this.email_regex))
      dispatcher.send('smtp', data, merge_opts('to'), callback);
    else if (destination.to.match(this.host_regex))
      dispatcher.send('http', data, merge_opts('url'), callback);
    else {
      this.say("Unknown destination: " + destination.to);
      this.paste(data);
    }

    delete(this.destinations[name]);

  };

  // transforms this "host:myhost.com user:god"
  // into this: {host: 'myhost.com', user: 'god' }
  this.parse_arguments = function(args){

    if (!args || args.trim() === '') return;

    try {
      var formatted = args.trim().replace(/([\w\.]+)/g,'"$1"').replace(/ /g, ',');
      return JSON.parse("{" + formatted + "}");
    } catch(e) {
      this.say("Invalid argument format.");
      return null;
    }

  };

  this.store_destination = function(context, destination, args){
    var opts = args.trim() === '' ? null : this.parse_arguments(args);
    this.destinations[context] = {to: destination, options: opts};
  };

  this.add_hook = function(when, event, body){

    var self = this,
        command = body.replace([when, event].join(' '), '').trim();

    this.combos[event] = command;
    this.say("Initialized hook for " + event);

    triggers.get(event, function(err, trigger_name){
        if (!err && trigger_name);

        self.emit('watch', trigger_name);
        self.say('Starting watching ' + trigger_name);
    })

  };

  this.parse_message = parser;

};

util.inherits(ConsoleDriver, Emitter);
exports.ConsoleDriver = ConsoleDriver;

exports.load = function(options, callback){
  this.console = new ConsoleDriver(options);
  this.console.load(callback);
};

exports.unload = function(){
  if (this.console)
    this.console.unload();
};
