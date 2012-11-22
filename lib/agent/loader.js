"use strict";

//////////////////////////////////////////
// Prey Plugin Loader Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
    logger = common.logger,
    join = require('path').join,
    util = require('util'),
    Emitter = require('events').EventEmitter;

var plugins_path = __dirname;

var log = function(str){
  logger.info("[loader] " + str);
};

var load = function(type, name, cb){

  var err,
      module,
      path = join(plugins_path, type + 's', name);

  logger.debug("Loading " + name + " " + type + "...");

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

exports.load_transport = function(name, cb){
  load('transport', name, cb);
};
