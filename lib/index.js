
"use strict";

global._ = require('underscore');

var fs = require('fs');

var namespace = {
  common        : './prey/common',
  agent         : './prey/agent',
  hooks         : './prey/hooks',
  dispatcher    : './prey/dispatcher',
  providers     : './prey/providers',
  triggers      : './prey/triggers',
  reports       : './prey/reports',
  helpers       : './prey/helpers',
  tunnel        : './prey/tunnel',
  register      : './prey/plugins/drivers/control-panel/register',
  hardware      : './prey/plugins/providers/hardware',
  network       : './prey/plugins/providers/network',
  windows       : './prey/os/windows',
  system        : './prey/plugins/providers/system',
  geo           : './prey/plugins/providers/geo',
  processes     : './prey/plugins/providers/processes',
  lan           : './prey/plugins/providers/lan',
  connections   : './prey/plugins/providers/connections',
  bandwidth     : './prey/plugins/providers/bandwidth',
  actions       : './prey/actions',
  alarm         : './prey/plugins/actions/alarm',
  lock         : './prey/plugins/actions/lock'
};

var debug = module.exports.debug = true;
var debug_log = '/home/ritchie/Projects/Prey/prey-node-client/debug.log';

if (fs.existsSync(debug_log)) {
  fs.unlinkSync(debug_log);
}

var send_out = function(msg) {
  if (debug)
    fs.appendFileSync(debug_log,msg +'\n');
  else 
    console.log(msg);
}

global._ns = function(id) {
  var ns = namespace[id];
  if (!namespace) {
    throw new Error("Namespace "+id+" unknown");
  }
  return require(ns);
};

_ns.provider = function(name) {
  return require('./prey/plugins/providers/'+name);
};

_ns.action = function(name) {
  return require('./prey/plugins/actions/'+name);
};

var inspect = require('util').inspect;
var print = require('util').print;

var debugMode = function() {
  debug = true;  
  send_out("*Debug mode* - correct");

  var common  = _ns('common');
  send_out("Config file in " +common.config_path);
  
  var dlog = function() {
    var e;
    if (typeof arguments[0] === 'object')
      e = inspect(arguments[0]);
    else
      e = arguments[0].toString();
    
    send_out(e);
    
  };

  send_out("    Intercepting logger ...");
  
  common.logger = {
    info:dlog,
    warn:dlog,
    debug:dlog,
    error:dlog,
    write:dlog,
    notice:dlog
  };

  var whichFile = function() {

    var e = new Error('blah'); 

    //  console.log("Error line: "+e.stack.split("\n")[3]);
    //console.log(e.stack);
  
    var m = e
          .stack
          .split("\n")[3]
          .trim()
          .match(/at (\S+) (\(([A-Z]:)?[^:]+):([0-9]+)/);
    
    return (m) ? {func:m[1],file:m[2],line:m[4] } : null;
  };
  
  var debug_error_handler = function(msg,context) {

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

  send_out("    Installing debug error handler...");
  global._error = debug_error_handler;

global._pr = function() {
  var args = Array.prototype.slice.call(arguments);
  var fn = args.shift();
  args.push(function(err,val) {
    _tr(val);
  });
  fn.apply(this,args);
  };
};


var error_handler = function(msg,context) {
  // check if first parameter is already an error object
  if (typeof msg === 'object') {
    if (msg.msg) 
       return msg;
    else
      return {msg:'External Error',context:msg} ;
  }

//  return new Error(msg);
  return {msg:msg,context:context};
};

/**
 * trace, global _tr could have been defined in another module (e.g. by configurator), don't overwrite if so.
 **/
 if (!global._tr) {
  global._tr = function(msg,obj) {
    if (debug) {
      if (typeof msg === "object") 
        send_out(inspect(msg,true,7,true));
      else {
        if (obj) {
          send_out(msg);
          send_out(inspect(obj,msg,7,true));
        } else
        send_out(msg);
      }
    } else
    console.log(msg);
  };
}

global._error = error_handler;

module.exports = {
  debugOn:debugMode
};
