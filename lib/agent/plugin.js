var common    = require('./common'),
    loader    = require('./loader'),
    hooks     = require('./hooks'),
    commands  = require('./commands'),
    providers = require('./providers');

var config    = common.config;

var base = {
  system    : common.system,
  helpers   : common.helpers,
  logger    : common.logger,
  hooks     : hooks,
  commands  : commands,
  providers : providers
}

var scoped_config = function(plugin_name) {

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

    writable: function(cb) {
      return config.writable(cb);
    }

  }

}

exports.load = function(name, cb) {
  loader.load_plugin(name, function(err, module) {
    if (err) return cb && cb(err);

    var obj = base;
    obj.config = scoped_config(name);
    module.load(obj, cb);
  })
}

exports.run = function(name, method, cb) {

}