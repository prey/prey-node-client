var fs         = require('fs'),
    join       = require('path').join,
    reply      = require('reply'),
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

var cache = {};

// returns the visible object that is passed over to plugin
// basically base + scoped_config
function visible(plugin_name) {
  var obj = base;
  obj.config = scoped_config(plugin_name);
  return obj;
}

// returns list of options in plugin's package.json
// if none exist, return an empty hash
var get_options = function(name, cb) {
  var opts = {};

  try {
    var def = require(join(plugins_path, name, 'package.json'))
    opts = def.options || {};
  } catch(e) {
    opts = {};
  }

  return opts;
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

// calls the given method from a plugin
// checks whether the function has a callback defined
// returns false if no method called, or true if called 
var call = function(plugin_name, method, cb) {
  var module = exports.require(plugin_name);
  if (!module) {
    cb && cb(new Error('Unable to load module: ' + plugin_name));
    return false;
  }

  if (typeof module[method] != 'function') {
    cb && cb();
    return false;
  }

  var obj   = visible(plugin_name),
      arity = module[method].length;

  if (arity == 0) {
    var res = module[method].call(obj);
    cb(null, res);
  }  else {
    module[method].call(obj, cb);
  }

  return true;
} 

var loader = {};

// tries to require a plugin and returns it
loader.get = function(type, name, cb) {
  var err,
      module,
      path = join(agent_path, type + 's', name);

  try {
    module = require(path);
  } catch(e) {
    err = e;
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
  return loader.get('plugin', plugin_name);
};

//////////////////////////////
// for configuration

exports.load = function(name, cb) {
  return call(name, 'load', cb);
}

exports.unload = function(name, cb) {
  return call(name, 'unload', cb);  
}

exports.setup = function(plugin_name, cb) {
  var mod = this.require(plugin_name);
  if (!mod) return cb && cb(new Error('Unable to load module: ' +  plugin_name));

  if (typeof mod.setup == 'function')
    return call(plugin_name, 'setup', cb);

  // ok, no custom setup function. let's check if it has options in its package.json
  var options = get_options(plugin_name);
  if (Object.keys(options).length == 0)
    return cb();

  // we got options, so let's prompt the user
  reply.get(options, cb);
}

exports.list = function(cb) {
  fs.readdir(plugins_path, cb);
}

exports.enabled = function(name, cb) {
  return call(name, 'enabled', cb);
}

exports.disabled = function(name, cb) {
  return call(name, 'disabled', cb);
}
