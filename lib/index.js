
//"use strict";



Prey = exports;

Prey.common     = require('./prey/common');
Prey.agent      = require('./prey/agent');
Prey.hooks      = require('./prey/hooks');
Prey.dispatcher = require('./prey/dispatcher');
Prey.providers  = require('./prey/providers');
Prey.reports    = require('./prey/reports');

Prey.utils = {};
Prey.utils.managedCache = require('./prey/utils/managed_cache');
Prey.utils.helpers = require('./prey/helpers');

/*
  this is experimentally here for the moment as it's convenient.
*/


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
