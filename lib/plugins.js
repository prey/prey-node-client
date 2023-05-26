var wink = require('wink'),
    config_key = 'plugin_list',
    config; // assigned later

////////////////////////////////////////////////
// helpers

// removes empty or '' values from array
var filter = function(arr) {
  return arr.filter(function(el) { return el.trim() != '' });
}

////////////////////////////////////////////////
// exports

// init the loader. this provides all(), get(), require() and invoke()
var plugins = wink.init(__dirname + '/agent/plugins');

// called from common lib after config is loaded
plugins.init = function(config_obj) {
  config = config_obj;
  return plugins;
}

plugins.exists = function(name) {
  var list = plugins.all();
  return list.keys.indexOf(name) !== -1;
}

plugins.get_enabled = function() {
  if (!config || !config.get)
    throw new Error('Config object not initialized!');

  var obj = config.get(config_key);

  if (obj && typeof obj == 'object')
    return filter(obj);

  return filter((obj || '').split(', '))
}

plugins.is_enabled = function(name) {
  var enabled = plugins.get_enabled();
  return enabled.indexOf(name) !== -1;
}

plugins.add = function(name, cb) {
  if (plugins.is_enabled(name))
    return cb(new Error('Already enabled: ' + name));

  if (!plugins.exists(name))
    return cb(new Error('Invalid plugin name: ' + name));

  var list = plugins.get_enabled(),
      result  = filter(list.concat([name]));

  config.update(config_key, result, cb);
}

plugins.remove = function(name, cb) {
  if (!plugins.is_enabled(name))
    return cb(new Error('Plugin not enabled: ' + name));

  var list  = plugins.get_enabled(),
      index = list.indexOf(name);

  list.splice(index, 1);
  var result = filter(list);

  config.update(config_key, result, cb);
}

module.exports = plugins;