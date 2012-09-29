
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
  managedCache  : './prey/utils/managed_cache',
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
var errs = require("./errors");

var whichFile = function() {
  var m = new Error('blah').stack.split("\n")[3].trim().match(/at (\S+) ([^:]+):([0-9]+)/);
  return (m) ? {func:m[1],file:m[2],line:m[3] } : null;
};

var debug_error_handler = function(code,context) {
  var e = errs[code];
  if (!e) {
    throw new Error("Don't know this error "+code);
  }
  
  var err = {code:code,msg:e.msg,context:context,location:whichFile()};
  console.log(inspect(err));
  return err;
};

var error_handler = function(code,context) {
    var e = errs[code];
    if (!e) {
      throw new Error("Don't know this error "+code);
    }

    var err = {code:code,msg:e.msg,context:context};
    return err;
};


global._error = (true) ? debug_error_handler : error_handler;
