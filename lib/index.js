
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
  var m = new Error('blah')
        .stack
        .split("\n")[3]
        .trim()
        .match(/at (\S+) ([^:]+):([0-9]+)/);
 
  return (m) ? {func:m[1],file:m[2],line:m[3] } : null;
};

/*
  errors defined in errors.js do not have trailing _, however to make the regex
  a stricter pattern for finding codes add _ so that we have repeating patterns of
  XXX_XXX_ etc. Thus only uppercase groups with _ can be error codes. That should not
  mix up with a general error message.
*/
var checkForCode = function(code) {
  var re = /(([A-Z]+)_)+/;
  var testCode = code+"_" ;
  return testCode.match(re);
};

var debug_error_handler = function(code,context) {
  if (typeof code === 'object') {
    if (!code.code) throw new Error('Some unknown error in first param:'+inspect(code));
    return code;
  }
  
  if (checkForCode(code)) {
    var e = errs[code];
    if (!e) {
      throw new Error("Don't know this error "+code);
    }
  
    var err = {code:code,msg:e.msg,context:context,location:whichFile()};
    console.log(inspect(err));
    return err;
  } else {
    var err = {code:'UNSPECIFIED',msg:code,context:context,location:whichFile()};
    
    console.log(inspect(err));
    return err;
  }
};

var error_handler = function(code,context) {
  if (typeof code === 'object') {
    if (!code.code) throw new Error('Some unknown error in first param:'+inspect(code));
    return code;
  }
    
  if (checkForCode(code)) {
    var e = errs[code];
    if (!e) {
      throw new Error("Don't know this error "+code);
    }
    
    return {code:code,msg:e.msg,context:context};
  } else {
    return {code:'UNSPECIFIED',msg:code,context:context};
  }
};


global._error = (true) ? debug_error_handler : error_handler;
