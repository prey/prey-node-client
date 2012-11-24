var settings = module.exports;

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
