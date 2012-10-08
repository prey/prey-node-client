"use strict";

//////////////////////////////////////////
// Prey Bandwidth Provider
// Written by Tomas Pollak
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var
  common = _ns('common'),
  os_functions = require('./platform/' + common.os_name),
  async = require('async'),
  max_samples = 3;

var parseBytes = function(bytes){
	if(bytes > 1048576)
		return (bytes/(1024*1024)).toString().substring(0,4) + " MB/s";
	else
		return (bytes/1024).toString().substring(0,5) + " KB/s";
};

var average = function(a){
	var total = 0;
	a.forEach(function(e){
		total += e;
	});
	return total/a.length;
};

var differentials = function(a) {
  var d = [];
  for (var i = 1; i < a.length; i++)
    d.push(a[i] - a[i-1]);
  return d;
};

var averages = function(a) {
  return parseBytes(average(differentials(a)));
};

var Bandwidth = function(){
  /**
   * returns {inBytes:number,outBytes:number} averages 
   **/
	this.get_bandwidth_usage = function(iface,callback) {
    var bag = {
      sampled:0,
      sent:[],
      received:[]
    };

    if (!iface) iface = "eth0";
    
    var sample = function(callback) {
      callback.data = bag;
      os_functions.sample(iface,callback);
    };

    async.whilst(function() { return bag.sampled < max_samples; },sample,function(err) {
      if (err) return callback(_error(err));
      callback(null, {inBytes:averages(bag.received) ,outBytes:averages(bag.sent)});
    });
	};

  this.get_bandwidth_usage.report = "Bandwidth Report";

};

module.exports = new Bandwidth();

