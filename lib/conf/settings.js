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
  var current = config.get('api_key');
  if (current === key)
    return cb && cb();

  // if api key is changed, make sure device key is cleared
  // to avoid bad things from happenning
  this.set_keys({api_key: key, device_key: ''}, cb);
}

settings.set_keys = function(keys, cb){
  if (keys.api_key.trim() == '')
    return cb(new Error('Trying to set empty API Key!'))

  config.set('api_key', keys.api_key);
  config.set('device_key', keys.device_key);
  config.save(cb);
}
