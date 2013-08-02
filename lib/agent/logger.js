//////////////////////////
// Basic Logger for NodeJS
// Based on TJ Holowaychuk's Log.js
// Colors codes from Dav Glass's awesome node-termcolors
// MIT Licensed
//////////////////////////

var colorizable,
    off = false;

var Log = function Log(level, options){

  var obj = this;
  this.pre = '';
  this.set_level(level);
  this.stream = options.stream || process.stdout;
  this.set_timestamp = options.set_timestamp || true; // this.stream.readable;

  colorizable = this.stream.isTTY;

  // HJ: Add this one to avoid the problems in testing
  //     due to every object requiring logger.
  this.stream.setMaxListeners(0);

  this.stream.once('error', function(err){
    if (!process.stdout.writable)
      return obj.off();

    obj.stream = process.stdout;
    console.error(err.toString());
  });

};

var PrefixLog = function(logger, prefix) {
  // copy logger object
  for (var key in logger)
    this[key] = logger[key];

  this.pre = '[' + prefix + '] ';
}

exports.init = function(level, options){
  return new Log(level || 'info', options || {});
}

var colors = {
  red: '31',
  light_red: '1;31',
  green: '32',
  light_green: '1;32',
  blue: '34',
  light_blue: '1;34',
  purple: '35',
  light_purple: '1;35',
  cyan: '36',
  light_cyan: '1;36',
  brown: '33',
  yellow: '1;33',
  white: '1;37',
  gray: '90',
  light_gray: '37',
  dark_gray: '1;30',
  black: '30',
  bold: '1'
};

var levels = [
  'error',   // 0
  'warn',    // 1
  'info',    // 3
  'debug'    // 4
];

var level_colors = {
  'shoot': 'light_red',
  'error': 'red',
  'warn': 'purple',
  'info': 'bold',
  'debug': 'yellow'
}

var colorize = function(str, color){
  return colorizable && color ? "\033[" + colors[color] + "m" + str + "\033[0m" : str;
};

var colorize_level = function(str){
  return colorize(str, level_colors[str]);
};

Log.prototype = {

  prefix: function(str){
    return new PrefixLog(this, str);
  },

  set_level: function(level){
    if (typeof level == 'string')
      level = levels.indexOf(level.toLowerCase());
    this.level = level;
  },

  off: function(){
    off = true;
  },

  on: function(){
    off = false;
    this.log('info', 'Logger is back on.');
  },

  critical: function(msg){
    this.log('shoot', msg);
  },

  error: function(err, source){
    var str = source ? err.toString() + ' <-- [' + source + ']' : err;
    this.log('error', str);
  },

  warn: function(msg){
    this.log('warn', msg);
  },

  notice: function(msg){
    this.log('warn', msg);
  },

  info: function(msg){
    this.log('info', msg);
  },

  debug: function(msg){
    this.log('debug', msg);
  },

  log: function(levelStr, msg) {

    if (!off && levels.indexOf(levelStr) <= this.level) {
      var str = colorize_level(levelStr) + "\t" + colorize(this.pre, 'blue') + msg;

      if (this.set_timestamp)
        str = colorize('[' + new Date + '] ', 'gray') + str;

      this.write(str);
    }

  },

  write: function(msg, color){
    this.stream.write(colorize(msg, color) + "\n");
  }

};
