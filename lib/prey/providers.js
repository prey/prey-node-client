"use strict";

//////////////////////////////////////////
// Prey Main Provider Class
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var 
    async = require('async'),
    fs = require('fs'),
    path = require('path'),
    providers_path = __dirname + '/plugins/providers',
    helpers = _ns('helpers');

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

  /**
   * Traverse the providers path and extract all functions marked as "reports", into the getters
   * object. Function name used as index has the get_ stripped.
   **/
  this.map = helpers.memoize(function(callback){
    var getters = {};
    var files = fs.readdirSync(providers_path);
    files.forEach(function(provider_name){
      var provider_path = path.join(providers_path, provider_name);      
      get_getters(require(provider_path)).forEach(function(getter) {
        getters[getter.name] = getter.mod;
      });
    });
    callback(getters);
  },function() { return "key"; });

  /**
   * Get data from a provider, the name passed in should correspond to one of the functions
   * retrieved by this.map.
   **/
  this.get = function(name, callback){
    self.map(function(getters) {
      if(!getters[name]) return callback(_error("Unable to find provider for " + name));
      var mod = getters[name];
      
      /* mmm, why does fn lose the this to the module on the call, where as the
       * array access doesn't ?? */
      var fn = mod['get_'+name];
      mod['get_'+name](function(err, result){
        if (err) return callback(_error(err));
        
        callback(null,result,name,fn.report);
      });
    });
  };

};

module.exports = new Providers();
