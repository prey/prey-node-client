"use strict";

//////////////////////////////////////////
// Prey Main Provider Class
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var
  fs = require('fs'),
  join = require('path').join,
  helpers = require('./common').helpers,
  exp = module.exports,
  reports;

var providers_path = join(__dirname, 'plugins', 'providers');

/**
 * Given a provider module, check it's keys for a functions with arity 0, return an
 * array of {func_name,module} pairs, so that the function can be called applied to its module.
 *
 * func_names should correspond to the report providers.
 **/
var get_getters = function(mod) {
  return Object.keys(mod)
    .filter(function(k) {
      return k.substr(0,3) === 'get' && typeof mod[k] === 'function';
    })
    .map(function(k) { return { name:k.substr(4), fn:mod[k]}; });
};

/**
 * Traverse the providers path and extract all functions marked as "reports", into the getters
 * object. Function name used as index has the get_ stripped.
 **/
exp.map = helpers.memoize(function(callback){

  var getters = {},
      files = fs.readdirSync(providers_path);

  files.forEach(function(provider_name){

    var provider_path = join(providers_path, provider_name);
    get_getters(require(provider_path)).forEach(function(getter) {
      getters[getter.name] = getter.fn;
    });

  });

  callback(null, getters);

},function() { return "key"; });

/**
 * Get data from a provider, the name passed in should correspond to one of the functions
 * retrieved by this.map.
 **/
exp.get = function(name, callback){

  exp.map(function(err, getters) {
    if (err) return callback(_error(err));

    if (!getters[name]) {

      if (!reports) reports = require('./reports');

      reports.get(name, function(err, data){
        if (err)
          callback(_error('Unable to find provider for ' + name));
        else
          callback(null, data);
      });

    } else {

      getters[name](function(err, result){
        if (err) return callback(_error(err));
        callback(null, result, name);
      });

    }

  });
};
