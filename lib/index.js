
"use strict";

/*
  This is experimental and here for now as it's convenient.
*/

var namespace = {
  common        : require('./prey/common'),
  agent         : require('./prey/agent'),
  hooks         : require('./prey/hooks'),
  dispatcher    : require('./prey/dispatcher'),
  providers     : require('./prey/providers'),
  reports       : require('./prey/reports'),
  managedCache  : require('./prey/utils/managed_cache'),
  helpers       : require('./prey/helpers')
};

global._ns = function(id) {
  var ns = namespace[id];
  if (!namespace) {
    throw new Error("Namespace "+id+" unknown");
  }

  return ns;
};

var inspect = require('util').inspect;
var errs = require("./errors");

var debug_error_handler = function(code,context) {
  var e = errs[code];
  if (!e) {
    throw new Error("Don't know this error "+code);
  }
  
  var err = {code:code,msg:e.msg,context:context};
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
