"use strict";

//////////////////////////////////////////
// Prey Main Provider Class
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var logger = _ns('common').logger,
    async = require('async'),
    fs = require('fs'),
    path = require('path'),
    providers_path = __dirname + '/plugins/providers';

/**
 * Given a provider module, check it's keys for a function marked as report, return an
 * array of {name:'',fn:''} pairs. These names should correspond to the report providers.
 **/
var get_getters = function(mod) {
 return Object.keys(mod)
      .filter(function(k) {
        return k.substr(0,3) === 'get' && typeof mod[k] === 'function' && "report" in mod[k];})
        .map(function(k) { return {name:k.substr(4),mod:mod }; });
};

var Providers = function() {
  var self = this;
  this.getters = {};

  /**
   * Traverse the providers path and extract all functions marked as "reports", into the getters
   * object. Function name used as index has the get_ stripped.
   **/
  this.map = async.memoize(function(){
    var files = fs.readdirSync(providers_path);
    files.forEach(function(provider_name){
      var provider_path = path.join(providers_path, provider_name);      
      get_getters(require(provider_path)).forEach(function(getter) {
        console.log(getter.name);
        self.getters[getter.name] = getter.mod
      });
    });
    return self.getters;
  },function() { return "key"; });

  /**
   * Get data from a provider, the name passed in should correspond to one of the functions
   * retrieved by this.map.
   **/
  this.get = function(name, callback){
    if(Object.keys(self.getters) === 0) self.map();
    if(!self.getters[name]) return callback(_error("Unable to find provider for " + name));
    var mod = self.getters[name];
    mod['get_'+name](function(err, result){
      if (err) return callback(_error(err));
      
      callback(null, name, result);
    });      
  };
};

module.exports = new Providers();
