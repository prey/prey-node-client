"use strict";

//////////////////////////////////////////
// Prey LAN Info Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var 
    common = _ns('common'),
    os_functions = require("./platform/"+common.os_name);

var Lan = function(){

  this.get_active_nodes_list = function(callback) {
    os_functions.get_active_nodes_list(callback);
  };
  
  this.get_active_nodes_list.report = true;
  
	this.get_ip_from_hostname = function(hostname, callback){
    os_functions.get_ip_from_hostname(hostname,callback);
	};

};

module.exports = new Lan();
