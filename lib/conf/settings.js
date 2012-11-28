var config = require('./../common').config,
    settings = module.exports;

settings.get = function(key){
  return config.get(key);
}

settings.list = function(){
  return Object.keys(config._values);
}

settings.update = function(key, val, cb){
  config.update(key, val, cb);
}

settings.present = function(){
  return config.present();
}

settings.set_api_key = function(key, cb){
  var current = config.get('control-panel');
  if (current.api_key === key)
    return cb()

  this.update('control-panel', {api_key: key, device_key: ''}, cb);
}

settings.set_keys = function(keys, cb){
  var data = {api_key: keys.api_key, device_key: keys.device_key};
  this.update('control-panel', data, cb);
}
