
"use strict";

global._ = require('underscore');

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
  actions       : './prey/actions',
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
  alarm         : './prey/plugins/actions/alarm',
  lock          : './prey/plugins/actions/lock'
};

global._ns = function(id) {
  var path = namespace[id];
  if (!path) {
    throw new Error("Namespace " + id + " unknown");
  }
  return require(path);
};

global._tr = function(msg){
  //
}

global._error = function(err, context) {
  // check if first parameter is already an error object
  if (typeof err === 'object') {
    if (err.msg)
       return err;
    else
      return {msg: 'External Error', context: err} ;
  }

//  return new Error(msg);
  return {msg: err, context: context};
};

_ns.provider = function(name) {
  return require('./prey/plugins/providers/' + name);
};

_ns.action = function(name) {
  return require('./prey/plugins/actions/' + name);
};

if (process.env.DEBUG) {
  var debug = require('./../utils').debug;
  debug.enable();
}
