var fs = require('fs');

// transforms this 'host:myhost.com user:god'
// into this: {host: 'myhost.com', user: 'god' }
var parse_arguments = function(args){
  if (!args || args.trim() === '') return;

  try {
    var formatted = args.trim().replace(/([\w\.]+)/g,"'$1'").replace(/ /g, ',');
    return JSON.parse('{' + formatted + '}');
  } catch(e) {
    console.log('Invalid argument format.');
  }
};

var get_destination = function(context, destination, args){
  var opts = args.trim() === '' ? null : parse_arguments(args);
  return {endpoint: destination, options: opts};
};

var command = function(command, target, options){
  return { command: command, target: target, options: options };
}

exports.parse = function(body){

  var c;

  if (matches = body.match(/^help\s?(\w+)?/))
    c = ['help', matches[1]];

  // on [event] [start|stop] [something]
  if (matches = body.match(/^(on|once) ([\w\-]+) (config|start|stop|get|set|send) (.+)/))
    c = ['hook', matches[1], matches[2], body];

  if (matches = body.match(/^config read ([\w-]+)/))
    c = ['config', [matches[1]] ];

  if (matches = body.match(/^config update (\w+)\s(?:to )?(\w+)/))
    c = ['command', command('update', matches[1], matches[2]) ];

  if (matches = body.match(/^start ([\w\-]+)(?: using|with )?(.*)/))
    c = ['command', command('start', matches[1], parse_arguments(matches[2]))];

  if (matches = body.match(/^watch ([\w\-]+)(?: using|with )?(.*)/))
    c = ['command', command('watch', matches[1], parse_arguments(matches[2]))];

  if (matches = body.match(/^stop ([\w\-]+)/))
    c = ['command', command('stop', matches[1])];

  if (matches = body.match(/^unwatch ([\w\-]+)/))
    c = ['command', command('unwatch', matches[1])];

  if (matches = body.match(/^(?:get|send) ([\w\/\.]+)(?: to )?([\w@\.:\/]+)?(?: using|with )?(.*)/)){

    // var destination = matches[2] ? [matches[1].trim(), matches[2].trim(), matches[3]] : {};

    if (matches[1][0] == '/' && fs.existsSync(matches[1].trim()))
      c = ['send_file', [matches[1].trim()]];
    else if (matches[1])
      c = ['command', command('get', matches[1].trim())];

  }

  return c;

}
