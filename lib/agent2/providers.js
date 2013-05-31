var fs         = require('fs'),
    join       = require('path').join,
    logger     = require('./common').logger.prefix('providers'),
    hooks      = require('./hooks');

var providers_path = join(__dirname, 'providers');

var reports,
    getters_list,
    callbacks = {};

var load_provider = function(name) {
  try {
    return require(join(providers_path, name));
  } catch(e) {
    hooks.trigger('error', e);
  }
}

/**
 * Given a provider module, check its keys for a functions that begin with 'get'
 * and return an array of {name, func} pairs, so that the function
 * can be called applied to its module.
 **/

var find_getters = function(module) {

  return Object.keys(module)
    .filter(function(k) {
      return k.substr(0,3) === 'get' && typeof module[k] === 'function';
    })
    .map(function(k) {
      return { name: k.substr(4), fn: module[k] };
    });
};

/**
 * Traverse the providers path and extract all getter function into the getters
 * object. Function name used as index has the get_ stripped.
 **/

var map = exports.map = function(cb){

  if (getters_list)
    return cb(null, getters_list);

  fs.readdir(providers_path, function(err, files){

    getters_list = {};
    files.forEach(function(provider_name){

      var module = load_provider(provider_name);
      if (!module) return;

      find_getters(module).forEach(function(getter) {
        getters_list[getter.name] = getter.fn;
      });

    });

    cb(null, getters_list);
  });

};

var get = exports.get = function(name, cb) {

  var callback = cb || function(){ /* noop */ };

  var fire_callbacks = function(name, err, result) {
    callbacks[name].forEach(function(fn){
      fn(err, result, name);
    });
    callbacks[name] = [];
  }

  map(function(err, getters) {

    if (err) return callback(err);

    if (getters[name]) {

      callbacks[name] = callbacks[name] || [];
      callbacks[name].push(callback);

      if (callbacks[name].length > 1)
        return logger.info(name + ' already in progress.');

      getters[name](function(err, result) {

        if (!cb) {  // only emit when no callback passed
          if (err)
            hooks.trigger('error', err);
          else
            hooks.trigger('data', name, result);
        }

        if (result && result.file && result.content_type)
          hooks.trigger('file', result.file) // this should be informed.

        fire_callbacks(name, err, result);
      });

    } else {

      if (!reports) reports = require('./reports');
      reports.get(name, {}, cb);

    }

  });

}
