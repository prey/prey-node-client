"use strict";

//////////////////////////////////////////
// Prey Main Provider Class
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var
  fs = require('fs'),
  path = require('path'),
  helpers = require('./common').helpers,
  exp = module.exports;

var providers_path = __dirname + '/plugins/providers';

/**
 * Given a provider module, check it's keys for a functions with arity 0, return an
 * array of {func_name,module} pairs, so that the function can be called applied to its module.
 *
 * func_names should correspond to the report providers.
 **/
var get_getters = function(mod) {
  return Object.keys(mod)
        .filter(function(k) {
          return k.substr(0,3) === 'get' &&
                typeof mod[k] === 'function' &&
                helpers.is_report(mod[k]);
        })
        .map(function(k) { return {name:k.substr(4),fn:mod[k]}; });
};

/**
 * Traverse the providers path and extract all functions marked as "reports", into the getters
 * object. Function name used as index has the get_ stripped.
 **/
exp.map = helpers.memoize(function(callback){
  var getters = {};
  var files = fs.readdirSync(providers_path);
  files.forEach(function(provider_name){
    var provider_path = path.join(providers_path, provider_name);
    get_getters(require(provider_path)).forEach(function(getter) {
      getters[getter.name] = getter.fn;
    });
  });

  callback(null,getters);
},function() { return "key"; });

/**
 * Get data from a provider, the name passed in should correspond to one of the functions
 * retrieved by this.map.
 **/
exp.get = function(name, callback){
  exp.map(function(err,getters) {
    if (err) return callback(_error(err));

    if(!getters[name]) return callback(_error("Unable to find provider for " + name));
    var fn = getters[name];
    (fn)(function(err, result){
      if (err) return callback(_error(err));

      callback(null,name,result);
    });
  });
};
