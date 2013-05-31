'use strict';

var common = require('./common'),
    logger = common.logger.prefix('loader'),
    join   = require('path').join;

var plugins_path = __dirname;

var load = exports.load = function(type, name, cb){

  var err,
      module,
      path = join(plugins_path, type + 's', name);

  logger.debug('Loading ' + name + ' ' + type + '...');

  try {
    module = require(path);
  } catch(e) {
    err = e;
  }

  cb(err, module);
};


exports.load_driver = function(name, cb){
  load('driver', name, cb);
};

exports.load_action = function(name, cb){
  load('action', name, cb);
};

exports.load_trigger = function(name, cb){
  load('trigger', name, cb);
};

exports.load_endpoint = function(name, cb){
  load('endpoint', name, cb);
};
