"use strict";

//////////////////////////////////////////
// Prey Main Provider Class
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
    fs = require('fs'),
    path = require('path'),
    providers_path = __dirname + '/plugins/providers';

var Providers = function() {

  _tr("in providers");
  
  var self = this;
  this.getters = {};

  this.map = function(){

    if(Object.keys(this.getters) > 0) return this.getters;

    var files = fs.readdirSync(providers_path);

    files.forEach(function(provider_name){
      var provider_path = path.join(providers_path, provider_name);
      var provider_getters = require(provider_path).getters || [];

      _tr("looking for providers for "+provider_name);
      provider_getters.forEach(function(getter){
        // console.log(getter + " -> " + provider_name);
        self.getters[getter] = provider_path;
      });
    });
    return this.getters;
  };

  this.get = function(name, callback){

    if(Object.keys(this.getters) === 0) this.map();
    // var callback = typeof options == 'function' ? options : callback;

    if(typeof this.getters[name] !== 'undefined'){

      this.get_data(name, function(err, key, result){
        callback(err, result);
      });

    } else {
      if(!this.reports)
        this.reports = require('./reports');

      if(this.reports.exists(name)) {

        this.reports.once(name, function(data){
          callback(null, data);
        });

        this.reports.get(name, {});
      } else {
        return callback(_error("Unable to find provider for " + name));
      }
    }
  };

  this.get_data = function(name, callback){
    var provider = this.getters[name];
    require(provider).get(name, function(err, result){
      callback(err, name, result);
    });
  };
};

module.exports = new Providers();
