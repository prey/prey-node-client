var config    = require('./../common').config,
    run       = require('./utils/run'),
    installed = require('./../agent/plugin'),
    reply     = require('reply');

function get_name(name) {
  return 'prey-plugin-' + name;
}

function exec(command, cb) {
  var opts = {
    stdout: process.stdout,
    stderr: process.stderr
  }

  run(command, opts, cb)
}

function get_enabled() {
  return (config.get('plugins') || '').split(', ').filter(function(el) { return el.trim() != '' });
}

function ensure_not_enabled(name, cb) {
  installed.list(function(err, list) {
    if (list.indexOf(name) == -1)
      return cb(new Error('Invalid plugin name: ' + name));

    var enabled = get_enabled();
    if (enabled.indexOf(name) != -1)
      return cb(new Error('Already enabled: ' + name));

    cb();
   })
}

function add_to_config(name, cb) {
  ensure_not_enabled(name, function(err) {
    if (err) return cb(err);

    var list = get_enabled(),
        now  = list.concat([name]);

    config.update('plugins', now.join(', '), cb);
  })
}

function remove_from_config(name, cb) {
  var list = get_enabled();

  if (list.indexOf(name) == -1)
    return cb(new Error('Plugin not enabled: ' + name));

  // console.log('Removing from config ' + name);

  var index = list.indexOf(name);
  list.splice(index);

  config.update('plugins', list.join(', '), cb);
}

// configure
function setup(name, cb) {
  installed.setup(name, function(err, opts) {
    if (opts) return config.update(name, opts, cb);

    cb(err, opts);
  })
}

function prune(name, cb) {
  config.update(name, null, cb);
}

///////////////////////////////////////////////////
// exports

exports.search = function(query, cb) {
  return cb(new Error('Not found.'));
}

/*
exports.install = function(plugin_name, cb) {
  exec('npm install ' + get_name(plugin_name), cb);
}

exports.remove = function(plugin_name, cb) {
  exec('npm remove ' + get_name(plugin_name), cb);
}
*/

exports.enabled = function() {
  return get_enabled();
}

exports.enable = function(name, cb) {
  if (!name)
    return cb(new Error('Plugin name required.'));

  var done = function(err) {
    prune(name, function(e) {
      cb(err);
    });
  }

  ensure_not_enabled(name, function(err) {
    if (err) return cb(err);

    // setup plugin options
    setup(name, function(err) {
      if (err) return done(err);

      // load plugin and notify activation
      installed.added(name, function(err) {
        if (err) return done(err);

        // if all good, then add to config
        add_to_config(name, done);
      })
    })
  })
}

exports.disable = function(name, cb) {
  if (!name)
    return cb(new Error('Plugin name required.'));

  installed.list(function(err, list) {
    if (list.indexOf(name) == -1)
      return cb(new Error('Invalid plugin name.'));

    installed.removed(name, function(err) {
      if (err) return cb(err);

      // remove plugin from list
      remove_from_config(name, cb);
    })
  });
}

exports.disable_all = function(cb) {
  var count, last_error;

  var done = function(err) {
    if (err) last_error = err;
    --count || cb(last_error);
  }

  installed.list(function(err, list) {
    if (err) return cb(err);

    count = list.length;

    list.forEach(function(name) {
      exports.disable(name, done)
    })
  })
}

exports.setup = setup;
exports.prune = prune;
exports.installed = installed.list;
exports.added = installed.added;
exports.removed = installed.removed;
exports.force_enable = add_to_config;
