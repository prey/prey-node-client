"use strict";

//////////////////////////////////////////
// Prey Bandwidth Provider
// Written by Tomas Pollak
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var common = _ns('common'),
    os_functions = require('./platform/' + common.os_name);

var Bandwidth = function(){

  /**
   * returns {inBytes:number,outBytes:number} averages 
   **/
	this.get_bandwidth_usage = function(callback) {
    os_functions.get_bandwidth_usage(callback);
	};

};

module.exports = new Bandwidth();
