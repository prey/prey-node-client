var fs       = require('fs'),
    config   = require('./../common').config,
    panel    = require('./panel'),
    plugins  = require('./plugins'),
    settings = require('./settings');

exports.get_current = function() {
  var keys = {
    api    : config.get('control-panel.api_key'),
    device : config.get('control-panel.device_key')
  };

  return keys;
}

exports.verify_current = function(cb) {
  var keys = this.get_current();

  if (!keys.api)
    return cb(new Error('API Key not found!'))
  else if (!keys.device)
    return cb(new Error('Device Key not found! Run `bin/prey` to link your device.'))

  panel.verify_keys(keys, cb);
}

exports.retrieve_old_keys = function(file, cb) {
  log('Reading config keys from file: ' + file);

  fs.readFile(file, function(err, data) {
    if (err) return cb(err);

    var str     = data.toString(),
        api_key = str.match(/api_key=([^\n]*)/),
        dev_key = str.match(/device_key=([^\n]*)/);

    if (!api_key[1] || api_key[1].trim() == '')
      return cb(new Error('No keys found in file: ' + file))

    var keys = {
      api: api_key[1].replace(/'/g, ''),
      device: dev_key[1] && dev_key[1].replace(/'/g, '')
    }

    panel.verify_keys(keys, function(err) {
      if (err) return cb(err);

      set_keys(keys, cb);
    });
  })
}

// returns false if api is empty
exports.is_api_key_set = function(){
  var keys = this.get_current();
  return keys.api && keys.api !== '';
}

// map keys object from API calls for use with settings.set_keys
exports.set = function(keys, cb) {
  var opts = {
    api_key: keys.api,
    device_key: keys.device
  }
  settings.set_keys(opts, cb);
}

// set api key and call setup so device gets linked
exports.set_api_key_and_register = function(key, cb) {

  // ensure everything
  var success = function() {
    plugins.force_enable('control-panel', function(err) {
      cb();
    });
  }

  settings.set_api_key(key, function(err){
    if (err) return cb(err);

    panel.register(function(err) {
      if (!err) return success();

      settings.set_api_key('', function(e) {
        cb(err);
      });
    });
  })
}
