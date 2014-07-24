var fs         = require('fs'),
    join       = require('path').join,
    common     = require('./common'),
    hooks      = require('./hooks'),
    commands   = require('./commands'),
    providers  = require('./providers'),
    transports = require('./transports');

var config     = common.config,
    agent_path = __dirname,
    plugins_path = join(agent_path, 'plugins');

var base = {
  version    : common.version,
  system     : common.system,
  helpers    : common.helpers,
  logger     : common.logger,
  program    : common.program,
  hooks      : hooks,
  commands   : commands,
  providers  : providers,
  transports : transports
}

// returns the visible object that is passed over to plugin
function visible(plugin_name) {
  var obj = base;
  obj.config = scoped_config(plugin_name);
  return obj;
}

var scoped_config = function(plugin_name) {

  function nested_key(key) {
    return typeof key == 'object' || key.indexOf('.') !== -1
  }

  return {
    get: function(key) {
      return config.get(plugin_name, key)
    },

    set: function(key, val) {
      var obj = {}
      obj[plugin_name] = {};
      obj[plugin_name][key] = val;
      return config.merge(obj, true);
    },

    update: function(key, val, cb) {
      if (this.set(key, val))
        return config.save(cb);
      else
        return cb ? cb(new Error('Unable to set value for key: ' + key)) : false;
    },

    save: function(cb) {
      return config.save(cb);
    },

    writable: function(cb) {
      return config.writable(cb);
    },

    global: {

      get: function(key) {
        if (nested_key(key))
          return false;

        return config.get(key);
      },

      set: function(key, val) {
        if (nested_key(key))
          return false;

        return config.set(key, val);
      },

      update: function(key, val, cb) {
        if (this.set(key, val))
          return config.save(cb);
        else
          return cb ? cb(new Error('Unable to set value for key: ' + key)) : false;
      }

    }

  }

}

var call = function(plugin_name, method, cb) {
  var module = exports.require(plugin_name);
  if (!module)
    return cb && cb(new Error('Unable to load module: ' + plugin_name))

  var obj = visible(plugin_name);

  if (typeof module[method] == 'function')
    return module[method].call(obj, obj, cb);
  else
    return cb ? cb() : true;
}

var loader = {};

loader.get = function(type, name, cb) {
  var err,
      module,
      path = join(agent_path, type + 's', name);

  try {
    module = require(path);
  } catch(e) {
    err = e;
    console.log(e.stack)
  }

  if (cb)
    cb(err, module);
  else
    return module;
};


loader.load_plugin = function(name, cb){
  return this.get('plugin', name, cb);
};

loader.load_action = function(name, cb){
  return this.get('action', name, cb);
};

loader.load_trigger = function(name, cb){
  return this.get('trigger', name, cb);
};

exports.loader = loader;

exports.require = function(plugin_name) {
  return loader.load_plugin(plugin_name);
}

exports.load = function(name, cb) {
  return call(name, 'load', cb);
}

//////////////////////////////
// for configuration

var get_options = function(name, cb) {
  var opts = {};

  try {
    opts = require(join(plugins_path, name, 'package.json')).options;
  } catch(e) {
    opts = {};
  }

  return opts;
}

exports.setup = function(plugin_name, cb) {
  var module = exports.require(plugin_name);
  if (!module)
    return cb(new Error('Unable to load module: ' + plugin_name))

  // if module has a custom setup function, go ahead
  if (typeof module.setup == 'function')
    return module.setup(visible(plugin_name), cb);

  // ok, no custom setup function. let's check if it has options in its package.json
  var options = get_options(name);
  if (Object.keys(options).length == 0)
    return cb();

  // we got options, so let's prompt the user
  reply.get(options, cb);
}

exports.list = function(cb) {
  fs.readdir(plugins_path, cb);
}

exports.added = function(name, cb) {
  return call(name, 'added', cb);
}

exports.removed = function(name, cb) {
  return call(name, 'removed', cb);
}
