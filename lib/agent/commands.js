var join      = require('path').join,
    common    = require('./common'),
    hooks     = require('./hooks'),
    actions   = require('./actions'),
    triggers  = require('./triggers'),
    providers = require('./providers'),
    reports   = require('./reports'),
    updater   = require('./updater'),
    storage   = require('./utils/storage'),
    devices   = require('./plugins/control-panel/api/devices');

const { v4: uuidv4 } = require('uuid');

var logger    = common.logger;
var watching  = false; // flag for storing new commands when fired

var storage2 = require('./utils/commands_storage');
storage2.init('commands');

////////////////////////////////////////////////////////////////////
// helpers

// transforms this 'host:myhost.com user:god'
// into this: {host: 'myhost.com', user: 'god' }
var parse_arguments = function(args) {
  if (!args || args.trim() === '') return;

  try {
    var formatted = args.trim().replace(/([\w\.]+)/g,'"$1"').replace(/" /g, '",');
    return JSON.parse('{' + formatted + '}');
  } catch(e) {
    console.log('Invalid argument format.');
  }

};

var get_destination = function(context, destination, args) {
  var opts = args.trim() === '' ? null : parse_arguments(args);
  return { endpoint: destination, options: opts };
};

var handle_error = function(err) {
  hooks.trigger('error', err);
}

////////////////////////////////////////////////////////////////////
// build/run/parse/perform/process exports

exports.build = function build(command, target, options) {
  var obj = { command: command, target: target };
  if (options) obj.options = options;
  return obj;
}

exports.run = function(command, target, options) {
  var obj = exports.build(command, target, options);
  if (obj) exports.perform(obj);
}

exports.parse = function(body) {
  var c;

  if (matches = body.match(/^help\s?(\w+)?/))
    c = ['help', matches[1]];

  // on [event] [start|stop] [something]
  if (matches = body.match(/^(on|once) ([\w\-]+) (config|start|stop|get|set|send) (.+)/))
    c = ['hook', matches[1], matches[2], body];

  if (matches = body.match(/^config read ([\w-]+)/))
    c = ['config', [matches[1]]];

  if (matches = body.match(/^config update (\w+)\s(?:to )?(\w+)/))
    c = ['command', this.build('update', matches[1], matches[2]) ];

  if (matches = body.match(/^upgrade/))
    c = ['command', this.build('upgrade')];

  if (matches = body.match(/^start ([\w\-]+)(?: (using|with) )?(.*)/))
    c = ['command', this.build('start', matches[1], parse_arguments(matches[3]))];

  if (matches = body.match(/^watch ([\w\-]+)(?: (using|with) )?(.*)/))
    c = ['command', this.build('watch', matches[1], parse_arguments(matches[3]))];

  if (matches = body.match(/^stop ([\w\-]+)/))
    c = ['command', this.build('stop', matches[1])];

  if (matches = body.match(/^unwatch ([\w\-]+)/))
    c = ['command', this.build('unwatch', matches[1])];

  if (matches = body.match(/^(?:get|send) ([\w\/\.]+)(?: to )?([\w@\.:\/]+)?(?: (using|with) )?(.*)/)) {

    // var destination = matches[2] ? [matches[1].trim(), matches[2].trim(), matches[3]] : {};

    if (matches[1][0] == '/' && matches[1].match(/\.(...?)/))
      c = ['send_file', [matches[1].trim()]];
    else if (matches[1])
      c = ['command', this.build('get', matches[1].trim())];

  }

  return c;
}

exports.perform = function(command) {
  console.log("PERFORM!!", command)
  if (!command)
    return handle_error(new Error('No command received'));

  ///////////////////////////////
  var id;
  if (command.id)
    id = command.id;
  else if (command.options && command.options.messageID)
    id = command.options.messageID;
  else 
    id = uuidv4();
  
  console.log("EL ID!!", id)

  if (command.body)
    command = command.body;

  ///////////////////////////////


  logger.debug("Command received: " + JSON.stringify(command));

  var methods = {
    'start'   : actions.start,     //check
    'stop'    : actions.stop,
    'watch'   : triggers.add,
    'unwatch' : actions.stop,
    'get'     : providers.get,     //check
    'report'  : reports.get,
    'cancel'  : reports.cancel,
    'upgrade' : updater.check
  }

  // Intercept {command: 'get', target: 'report', options: {interval: 5}}
  // This kind of report should be storable. To ensure it can be stored we need
  // to change it to {command: 'report', target: 'stolen'}
  if (command.command === "get" && command.target === "report" && command.options.interval) {
    command.command = 'report';
    command.target = 'stolen';
  }

  // Automation command to mark as missing and recovered from here
  if (command.command === "start" && (command.target === "missing" || command.target === "recover")) {
    var set_missing = command.target === "missing" ? true : false;

    // Set as missing or recovered on the control panel
    devices.post_missing(set_missing, (err) => {
      if (err) logger.warn('Unable to set missing state to the device: ' + err.message);
    });

    // Initialize (or end) reports process on the client
    var is_stolen = reports.running().some(e => e.name == 'stolen');
    if (set_missing && !is_stolen) {
      command.command = 'report';
      command.target = 'stolen';
    } else {
      command.command = 'cancel';
      command.target = 'stolen';
    }
  }

  var type    = command.command || command.name,
      method  = methods[type];

  console.log("TYPE!!", type)
  // start report: report
  // stop report: stop
  // location: get
  // action: start

  if (method) {
    hooks.trigger('command', method, command.target, command.options);
    console.log("METHOD!!", method.toString())
    if (command.command != 'start')
      method(command.target, command.options);
    else{

        verify_if_exist_id(type,id,command.target,command.options,function (err,rows) {
        if (rows.length==0) {
          method(id, command.target, command.options); //ejecuta la accion
        }
      })

      //method(id, command.target, command.options); //ejecuta la accion
    }
     
    update_stored(type, id, command.target, command.options);
  } else {
    handle_error(new Error('Unknown command: ' + (command.command || command.name)))
  }
}

exports.process = function(str) {
  try {
    var commands = JSON.parse(str);
    logger.info('Got commands.');
  } catch(e) {
    return handle_error(new Error('Invalid commands: ' + str));
  }

  commands.forEach(this.perform);
}

////////////////////////////////////////////////////////////////////
// command persistence

var store = function(type, id, name, opts, cb) {
  var key = [type, name].join('-');
  logger.debug('Storing command in DB: ' + key);
  // storage.set(key, { command: type, target: name, options: opts }, cb);

  storage2.do('set', {type: 'commands', id: id, data: {command: type, target: name, options: opts }}, cb);
}

var remove = function(type, id, name, cb) {
  var key = [type, name].join('-');
  logger.debug('Removing command from DB: ' + key);
  // storage.del(key, cb);
  storage.do('del', { type: 'commands', id: id }, cb)
}

var verify_if_exist_id = function(type, id, name,opts, cb) {
  storage2.do('query', {type: 'commands',column : "id", data: id }, function (err,rows) {
    return cb(err,rows)
  });
}

// record when actions, triggers and reports are started
var update_stored = function(type, id, name, opts) {
  if (!watching) return;

  var storable = ['start', 'watch', 'report'];

  if (type == 'cancel') // report cancelled
  {
    remove('report', id, name);
  }
   
  else if (storable.indexOf(type) !== -1) {
    store(type, id, name, opts);
  }// ok for launch
    
}

// listen for new commands and add them to storage, in case the app crashes
var watch_stopped = function() {
  if (!watching) return;

  hooks.on('action', function(event, id) { 
    if (event == 'stopped' || event == 'failed') {
      storage2.do('update', { type: 'commands', id: id, columns: 'stopped', values: new Date().toISOString() }, (err) => {
        console.log("ERR2", err)
      })
    }

    if (event == 'started') {
      storage2.do('update', { type: 'commands', id: id, columns: 'started', values: new Date().toISOString() }, (err) => {
        console.log("ERR2", err)
      })
    }
      // remove('start', name);
  });

  hooks.on('trigger', function(event, name) {
    if (event == 'stopped')
      remove('watch', name);
  });
}

exports.start_watching = function() {
  watching = true;
  watch_stopped();
}

exports.stop_watching = function() {
  watching = false;
}

exports.run_stored = function(cb) {
  storage2.do('all', {type: 'commands'}, (err, commands) => {
    if (err)
      return logger.error(err.message); 

    var count = Object.keys(commands).length;
    if (count <= 0)
      return;

    for (id in commands) {
      if (commands[id].started == 'NULL') {
        logger.warn('Relaunching ...');
        exports.perform(commands[id]);
        continue;
      }
      else { // started != NULL
        if (commands[id].started_resp == 0) {
          // notificar
        }
        if (commands[id].stopped == 'NULL') {
          logger.warn('Relaunching ...');
          exports.perform(commands[id]);
          continue;
        }
        else if (commands[id].stopped_resp == 0) {
          // notificar
        }
      }
    }

  })
}
