var fs         = require('fs'),
    join       = require('path').join,
    logger     = require('./common').logger.prefix('providers'),
    hooks      = require('./hooks');

var providers_path = join(__dirname, 'providers');

var reports,
    getters_list,
    files     = [],
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

  fs.readdir(providers_path, function(err, files) {
    if (err) return cb(err);

    getters_list = {};
    files.forEach(function(provider_name){

      var module = load_provider(provider_name);
      if (!module) return;

      find_getters(module).forEach(function(getter) {
        getters_list[getter.name] = getter.fn;
      });

    });

    hooks.trigger('providers_ready');

    cb(null, getters_list);
  });

};
/**
 * providers.get takes care of calling a specified provider and either
 * calling the callback with the result or firing an error or data event
 * depending on the result.
 *
 * Examples:
 * get('users', callback)
 * get('tree', {user: 'someuser'})
 * get('tree', {user: 'someuser'}, callback)
 */
var get = exports.get = function(name, extra) {

  var args = arguments,
      cb,
      options;

  if (typeof(extra) === 'function') {
    cb = extra;
  } else {
    options = extra;
    // in case there's a third argument and it's a cb
    if (args[2] && typeof(args[2]) === 'function')
      cb = args[2];
  }

  var fire_callbacks = function(name, err, result) {
    var list = callbacks[name];
    callbacks[name] = [];

    list.forEach(function(fn){
      fn(err, result, name);
    });
  }

  if (name == 'report')
    name = 'stolen';

  map(function(err, getters) {
    if (err && cb) return cb(err);

    if (getters[name]) {

      callbacks[name] = callbacks[name] || [];
      if (cb) callbacks[name].push(cb);

      if (callbacks[name].length > 1) {
        return logger.info(name + ' already in progress.');
      }

      logger.debug('Fetching ' + name);

      if (options) {
        getters[name](options, getter_cb);
      } else {
        getters[name](getter_cb);
      }

      function getter_cb(err, result) {

        fire_callbacks(name, err, result);

        if (!cb) {  // only emit when no callback passed
          if (err)
            hooks.trigger('error', err);
          else
            hooks.trigger('data', name, result);
        }

        if (result && result.file && result.content_type) {
          files.push(result.file); // keep a record so we remove it afterwards
        }

      }

    } else {

      if (!reports) reports = require('./reports');
      reports.get(name, args[1], args[2]); // pass original arguments

    }

  });

}

exports.remove_files = function(cb) {
  var last_error,
      count = files.length;

  var done = function(err) {
    if (err) last_error = err;
    --count || (cb && cb(last_error));
  }

  files.forEach(function(entry) {
    if (entry.file && entry.content_type)
      fs.unlink(entry.file, done);
  });
}