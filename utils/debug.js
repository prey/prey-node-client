var fs = require('fs'),
    util = require('util'),
    inspect = util.inspect,
    debug_log = __dirname + '/../debug.log',
    indent = '',
    debug;

var send_out = function(msg) {
  if (debug)
    fs.appendFileSync(debug_log,msg +'\n');
  else
    console.log(msg);
}

var dlog = function() {
  var e;
  if (typeof arguments[0] === 'object')
    e = inspect(arguments[0]);
  else
    e = arguments[0].toString();

  send_out(e);
};


var error_handler = function(msg, context) {

  // check if first parameter is already an error object
  if (typeof msg === 'object') {
    if (!msg.msg) throw new Error('Some unknown error in first param:'+inspect(msg));
    return msg;
  }

  var err = {msg:msg,context:context,location:whichFile()};

  send_out(">>> -----------------------------------------------------------------");
  send_out(inspect(err));
  send_out("<<< -----------------------------------------------------------------");
  return err;
};

var tr = function(msg, obj) {
  var m = msg.split(/^([0-9]):/);

  if (m.length === 1) {
    send_out(debug_log, indent + ' -- '+m[0]);
  }

  if (m.length === 3) {
    var lev = m[1];
    if (lev > 0 || lev !== indent.length) {
      indent = '';
      for (var i = 0; i < lev ; i++)
        indent += ' ';
    }

    var log_line = indent+m[2];
    send_out(debug_log, log_line);
  }

  if (obj) {
    console.log(inspect(obj));
  }
};

exports.enable = function() {

  if (fs.existsSync(debug_log)) {
    fs.unlinkSync(debug_log);
  }

  var common  = _ns('common');

  debug = true;
  send_out("*Debug mode* - correct");
  send_out("Config file in " + common.config_path);
  send_out("    Intercepting logger ...");

  common.logger = {
    info:dlog,
    warn:dlog,
    debug:dlog,
    error:dlog,
    write:dlog,
    notice:dlog
  };

  send_out("    Installing debug error handler...");

  _error = error_handler;
  _tr = tr;

}
