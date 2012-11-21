"use strict";

//////////////////////////////////////////
// Prey LAN Info Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var
  os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
  os_functions = require("./platform/" + os_name);

exports.get_active_nodes_list = function(callback) {
  os_functions.get_active_nodes_list(callback);
};

exports.get_ip_from_hostname = function(hostname, callback) {
  os_functions.get_ip_from_hostname(hostname,callback);
};
