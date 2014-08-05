var wink = require('wink'),
    config_key = 'plugin_list',
    config; // assigned later

// init the loader. this provides all(), get(), require() and invoke()
var plugins    = wink.init(__dirname + '/agent/plugins');

// called from common lib after config is loaded
plugins.init = function(config_obj) {
  config = config_obj;
  return this;
}

plugins.exists = function(name) {
  var list = this.all();
  return list.keys.indexOf(name) !== -1;
}

plugins.get_enabled = function() {
  var obj = config.get(config_key);
  if (obj && obj.length)
    return obj;

  return (obj || '').split(', ').filter(function(el) { return el.trim() != '' });
}

plugins.is_enabled = function(name) {
  var enabled = this.get_enabled();
  return enabled.indexOf(name) !== -1;
}

plugins.add = function(name, cb) {
  if (this.is_enabled(name))
    return cb(new Error('Already enabled: ' + name));

  if (!this.exists(name))
    return cb(new Error('Invalid plugin name: ' + name));

  var list = this.get_enabled(),
      result  = list.concat([name]).filter(function(el) { return el && el.trim() != '' });

  config.update(config_key, result, cb);
}

plugins.remove = function(name, cb) {
  if (!this.is_enabled(name))
    return cb(new Error('Plugin not enabled: ' + name));

  var list  = this.get_enabled(),
      index = list.indexOf(name);

  list.splice(index, 1);
  var result = list.filter(function(el) { return el && el.trim() != '' });

  config.update(config_key, result, cb);
}

module.exports = plugins;