var fs       = require('fs'),
    log      = require('./log'),
    config   = require('./../../common').config,
    panel    = require('./panel');

////////////////////////////////////////
// getters

// returns false if api is empty
exports.is_api_key_set = function(){
  var keys = this.get();
  return keys.api && keys.api.toString().trim() !== '';
}

exports.get = function() {
  var keys = {
    api    : config.get('control-panel.api_key'),
    device : config.get('control-panel.device_key')
  };

  return keys;
}

exports.del = function() {
  config.update('control-panel.api_key', '');
  config.update('control-panel.device_key', '');
}

////////////////////////////////////////
// setters

exports.set = function(keys, cb){
  if (keys.api && keys.api.toString().trim() == '')
    return cb(new Error('Trying to set empty API Key!'))

  if (keys.api)
    config.set('control-panel', { api_key: keys.api });

  if (typeof keys.device != 'undefined')
    config.set('control-panel', { device_key: keys.device });

  config.save(cb);
}

exports.set_api_key = function(key, cb){
  // if api key is changed, make sure device key is cleared
  // to avoid bad things from happenning
  this.set({ api: key, device: '' }, cb);
}

exports.set_device_key = function(key, cb) {
  this.set({ device: key }, cb);
}

////////////////////////////////////////
// checkers

exports.verify_current = function(cb) {
  var keys = this.get();

  if (!keys.api)
    return cb(new Error('API Key not found!'))
  else if (!keys.device)
    return cb(new Error('Device Key not found! Run `bin/prey` to get your device linked.'))

  panel.verify_keys(keys, cb);
}

exports.retrieve_old_keys = function(file, cb) {
  log('Reading config keys from file: ' + file);

  fs.readFile(file, function(err, data) {
    if (err) {
      log(err.message);
      return cb(err);
    }

    var str     = data.toString(),
        api_key = str.match(/api_key=([^\n]*)/),
        dev_key = str.match(/device_key=([^\n]*)/);

    if (!api_key[1] || api_key[1].trim() == '')
      return cb(new Error('No keys found in file: ' + file))

    var keys = {
      api    : api_key[1].replace(/'/g, ''),
      device : dev_key[1] && dev_key[1].replace(/'/g, '')
    }

    panel.verify_keys(keys, function(err) {
      if (err) return cb(err);

      exports.set(keys, cb);
    });
  })
}
