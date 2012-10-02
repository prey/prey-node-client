
"use strict";

var namespace = {
  common        : './prey/common',
  agent         : './prey/agent',
  hooks         : './prey/hooks',
  dispatcher    : './prey/dispatcher',
  providers     : './prey/providers',
  triggers      : './prey/triggers',
  reports       : './prey/reports',
  helpers       : './prey/helpers',
  hardware      : './prey/plugins/providers/hardware',
  network       : './prey/plugins/providers/network',
  wmic          : './prey/os/windows/wmic',
  system        : './prey/plugins/providers/system',
  geo           : './prey/plugins/providers/geo'  
};

global._ns = function(id) {
  var ns = namespace[id];
  if (!namespace) {
    throw new Error("Namespace "+id+" unknown");
  }
  return require(ns);
};

var inspect = require('util').inspect;
var print = require('util').print;

var debug = false;

var debugMode = function() {

  debug = true;
  
  console.log("*Debug mode*");
  console.log("    Intercepting logger ...");

  var dlog = function() {
    var e;
    if (typeof arguments[0] === 'object')
      e = inspect(arguments[0]);
    else
      e = arguments[0].toString();
    
    print("LLL -> ");
    console.log(e);
    
  };
  
  var common = _ns("common");
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
    
    console.log(">>> -----------------------------------------------------------------");
    console.log(inspect(err));
    console.log("<<< -----------------------------------------------------------------");
    return err;
  };

  console.log("    Installing debug error handler...");
  global._error = debug_error_handler;
};


var error_handler = function(msg,context) {
  // check if first parameter is already an error object
  if (typeof msg === 'object') {
    if (!msg.msg) throw new Error('Some unknown error in first param:'+inspect(msg));
    return msg;
  }

  return new Error(msg);
  //return {msg:msg,context:context};
};

/**
 * trace
 **/
global._tr = function(msg,obj) {
  if (debug) {
    print (">>> ");
    if (typeof msg === "object") 
      console.log(inspect(msg));
    else {
      if (obj) {
        print(msg);
        console.log(inspect(obj));
      } else
        console.log(msg);
    }
  }
};

global._error = error_handler;

module.exports = {
  debugOn:debugMode
};