var fs         = require('fs'),
    join       = require('path').join,
    reply      = require('reply'),
    memorize   = require('memorize'),
    common     = require('./common');

var config       = common.config,
    ennio        = common.plugins,
    agent_path   = __dirname;

var get_base_object = function() {
  return {
    version    : common.version,
    system     : common.system,
    helpers    : common.helpers,
    program    : common.program,
    hooks      : require('./hooks'),
    commands   : require('./commands'),
    providers  : require('./providers')
  }
}

// returns the visible object that is passed over to plugin
// basically base + scoped_config + scoped_logger
function visible(plugin_name) {
  var obj = get_base_object();
  obj.config = scoped_config(plugin_name);
  obj.logger = scoped_logger(plugin_name);
  return obj;
}

var scoped_config = function(plugin_name) {
  // console.log('Scoped config for ' + plugin_name);

  function nested_key(key) {
    return typeof key == 'object' || key.indexOf('.') !== -1
  }

  return {

    all: function() {
      return config.get(plugin_name);
    },

    get: function(key) {
      return config.get(plugin_name, key)
    },

    set: function(key, val) {
      if (val == null || typeof val === 'undefined')
        return;

      var obj = {};
      obj[plugin_name] = {};
      obj[plugin_name][key] = val;
      return config.merge(obj, true);
    },

    update: function(key, val, cb) {
      if (this.set(key, val))
        return config.save(cb);
      else
        return cb ? cb(new Error('Unable to set value for key: ' + key)) : undefined;
    },

    reload: function(cb) {
      return config.reload(cb);
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
          return;

        return config.get(key);
      },

      set: function(key, val) {
        if (nested_key(key))
          return;

        return config.set(key, val);
      },

      update: function(key, val, cb) {
        if (this.set(key, val))
          return config.save(cb);
        else
          return cb ? cb(new Error('Unable to set value for key: ' + key)) : false;
      },

      save: function(cb) {
        return config.save(cb);
      }

    }

  }

};

var scoped_logger = function(plugin_name) {
  var obj    = common.logger.prefix(plugin_name);
  obj.pause  = function() { common.logger.pause()  };
  obj.resume = function() { common.logger.resume() };
  return obj;
}

//////////////////////////////
// exports

exports.setup = function(name, cb) {
  return ennio.invoke(name, 'setup', visible(name), cb);
}

exports.load = function(name, cb) {
  return ennio.invoke(name, 'load', visible(name), cb);
}

exports.unload = function(name, cb) {
  return ennio.invoke(name, 'unload', visible(name), cb);
}

exports.enabled = function(name, cb) {
  return ennio.invoke(name, 'enabled', visible(name), cb);
}

exports.disabled = function(name, cb) {
  return ennio.invoke(name, 'disabled', visible(name), cb);
}
