
"use strict";

global._ = require('underscore');

var namespace = {
  common        : './common',
  agent         : './agent',
  hooks         : './hooks',
  dispatcher    : './dispatcher',
  providers     : './providers',
  triggers      : './triggers',
  reports       : './reports',
  helpers       : './helpers',
  tunnel        : './tunnel',
  actions       : './actions',
  register      : './plugins/drivers/control-panel/register',
  hardware      : './plugins/providers/hardware',
  network       : './plugins/providers/network',
  windows       : './os/windows',
  system        : './plugins/providers/system',
  geo           : './plugins/providers/geo',
  processes     : './plugins/providers/processes',
  lan           : './plugins/providers/lan',
  connections   : './plugins/providers/connections',
  bandwidth     : './plugins/providers/bandwidth',
  alarm         : './plugins/actions/alarm',
  lock          : './plugins/actions/lock'
};

module.exports = function(id) {
  var path = namespace[id];
  if (!path) {
    throw new Error("Namespace " + id + " unknown");
  }
  return require(path);
};
