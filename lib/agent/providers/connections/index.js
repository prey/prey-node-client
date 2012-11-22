"use strict";

//////////////////////////////////////////
// Prey Process List Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./platform/' + os_name);

exports.get_outbound_connections_list = function(callback) {
  os_functions.get_outbound_connections_list(callback);
};
