/**************************************************
 *
 * Operetta: A Node Option Parser That Sings!
 * Dmytri Kleiner <dk@trick.ca>
 * Modified by Tomas Pollak <tomas@forkhq.com> - Nov, 2012
 *
 * This program is free software.
 * It comes without any warranty, to the extent permitted by
 * applicable law. You can redistribute it and/or modify it under the
 * terms of the Do What The Fuck You Want To Public License v2.
 * See http://sam.zoy.org/wtfpl/COPYING for more details.
 *
 ***********************************/

var events = require('events'),
    path   = require('path'),
    util   = require('util');

var Operetta = function(args, scope) {
  if (args) {
    this.args = args;
  } else {
    if (process.argv[0].match(/node(\.exe)?$/))
      this.args = process.argv.slice(2);
    else
      this.args = process.argv.slice(1);
  }

  this.scope    = scope;
  this.params   = {}; // options which are paramaters
  this.opts     = {}; // options which are not parameters
  this.keyword_name = null;

  this.commands = {};
  this.values   = {};
  this.values.positional = [];

  this.help     = '';
  this.script   = path.basename(process.argv[1]);

  this.parent = null;

  // universal option detector
  this.re = /^(-[^-])([A-Za-z0-9_\-]+)?$|^(--[A-Za-z0-9_\-]+)[=]?(.+)?$/;

  this.parse = function(listener) {

    var operetta = this, parameter;

    var sing = function(argument, data) {
      argument = argument || current;

      if (argument == 'positional') {
        operetta.values[argument] = operetta.values[argument] || [];
        operetta.values[argument].push(data);

        if (operetta.keyword_name)
          operetta.values[operetta.keyword_name] = data;
      } else {
        operetta.values[argument] = data;
      }

      if (operetta.listeners(argument).length > 0) 
        operetta.emit(argument, data);

      parameter = undefined;
      current = undefined;
    }

    var analyze = function(option, data) {
      parameter = operetta.params[option];

      if (!parameter) { // option, lets use the first option argument as the valid one
        option = operetta.options[option] || option;
      }

      if (data || !parameter) 
        sing(parameter || operetta.opts[option] || option, data || true);
    }

    while (operetta.args.length > 0) {

      var current = operetta.args.shift(),
                m = operetta.re.exec(current);

      if (m) {

        if (parameter) { 
          sing(parameter, null);
        }

        if (m[2]) {

          var options = m[1][1] + m[2];

          for (i in options) {

            var a = operetta.params["-" + options[i]];
            if (a) {
              analyze(a, options.slice(parseInt(i) + 1));
              break;

            } else { 
              analyze("-" + options[i]);
            }
          }

        } else { 
          analyze(m[1] || m[3], m[4]);
        }

      } else if (parameter) {

        sing(parameter, current);

      } else {

        sing('positional', current);
      }

    }

    if (listener) 
      listener(operetta.values);
  };
};

util.inherits(Operetta, events.EventEmitter);

Operetta.prototype.start = function(callback) {
  var operetta = this;

  // if has subcommands and none was passed, show options
  if (this.args.length == 0 && Object.keys(this.commands).length > 0)
    return operetta.usage();

  // if run without arguments, and either root or command that requires them, show help
  if (this.args.length == 0 && (!this.parent || Object.keys(this.params).length > 0))
    return operetta.usage();

  // if helps is passed
  if (this.args[0] && (this.args[0] == '-h' || this.args[0].match(/(--)?help$/)))
    return operetta.usage();

  // if (operetta.opts.length > 0 && operetta.args.length == 0) 
  //  operetta.usage();

  var arg     = operetta.args[0],
      command = operetta.commands[arg];

  // command found, so initialize a child instance
  if (command) {
    operetta.args.shift();

    var child = new Operetta(operetta.args, arg);
    child.parent = operetta;
    command(child);

  // last argument is not a option/argument, so invalid command
  } else if (!operetta.keyword_name && typeof arg == 'string' && arg[0] != '-') { 
    operetta.usage();

  // valid command with options, so go.
  } else {
    operetta.parse(callback);
  }

};

Operetta.prototype.bind = function(args, description, listener, type) {
  if (args) {
    var operetta  = this;

    if (args.constructor !== Array)
      args = [args];

    var key   = args[0];
        sargs = args.join(", ");

    if (!operetta.width)
      operetta.width = sargs.length + 5;

    if (sargs.length > operetta.width)
      throw new Error('Argument length too long: ' + sargs);

    operetta.help += "\n  " + sargs + Array(operetta.width - sargs.length).join(" ") + description;

    args.forEach(function(option) {
      // strip out everything after a space, in case the param was written as --param [something]
      var opt = option.replace(/\s.*/, '');
      operetta[type][opt] = key;
    });

    if (listener) operetta.on(key, listener);
  }
};

Operetta.prototype.parameters = function(args, description, listener) {
  this.bind(args, description, listener, 'params');
};

Operetta.prototype.options = function(args, description, listener) {
  this.bind(args, description, listener, 'options');
};

Operetta.prototype.keyword = function(name, description, listener) {
  this.keyword_name = name;
  this.help += "\n  " + name + Array(16 - name.length).join(" ") + description;
};

Operetta.prototype.command = function(command, description, listener) {
  this.help += "\n  " + command + Array(16 - command.length).join(" ") + description;
  this.commands[command] = listener;
};

Operetta.prototype.banner = function() {
  var scopes  = this.get_scope(),
      command = scopes.filter(function(x) { return !!x }).join(' '),
      has_commands = Object.keys(this.commands).length > 0;

  var last = this.keyword_name ? '[' + this.keyword_name + ']' : has_commands ? '[command]' : '';

  return '\n  Usage: ' + this.script + ' ' + command + ' ' + last;
}

Operetta.prototype.get_scope = function() {
  var scopes = [this.scope],
      obj   = this.parent;

  while (obj) {
    scopes.push(obj.scope);
    obj = obj.parent;
  }

  return scopes.reverse();
}

Operetta.prototype.usage = function(values, listener) {

  var help  = this.help == '' ? '\n  No options available.' : this.help;
  var usage = [this.banner(), help].join("\n");

  if (listener) {
    listener(usage);
  } else {
    console.log(usage + '\n');
    process.exit(2);
  }
};

exports.Operetta = Operetta;
