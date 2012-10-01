
"use strict";

/*
  This is experimental and here for now as it's convenient.
*/

console.log('Loading globals');

var namespace = {
  common        : './prey/common',
  agent         : './prey/agent',
  hooks         : './prey/hooks',
  dispatcher    : './prey/dispatcher',
  providers     : './prey/providers',
  reports       : './prey/reports',
  AsyncCache    : './prey/utils/async_cache',
  helpers       : './prey/helpers',
  hardware      : './prey/plugins/providers/hardware',
  network       : './prey/plugins/providers/network',
  wmic          : './prey/os/windows/wmic',
  system        : './prey/plugins/providers/system'
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

  console.log("ERR -------------");
  console.log(inspect(err));

  return err;
};

var error_handler = function(msg,context) {
  // check if first parameter is already an error object
  if (typeof msg === 'object') {
    if (!msg.msg) throw new Error('Some unknown error in first param:'+inspect(msg));
    return msg;
  }
  
  return {msg:msg,context:context};

};

global._trace = function(msg,obj) {
  if (typeof msg === "object") 
    console.log(inspect(msg));
  else {
    if (obj) {
      print(msg);
      console.log(inspect(obj));
    } else
      console.log(msg);
  }
};

global._error = (true) ? debug_error_handler : error_handler;
