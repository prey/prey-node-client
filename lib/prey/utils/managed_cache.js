/*jshint latedef:true unused:true undef:true node:true */
"use strict";

//////////////////////////////////////////
// Prey Actions Cache Class
// (c) 2011 - Fork Ltd.
// by Ritchie Turner - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

/*
  ManagedCache

  This cache is slightly different from usual variants in that you do not set
  key values directly but provide a generation function, and a freshen
  function which determine what will be generated and when.

*/

var logger = require('../common').logger,
		util = require('util'),
		Emitter = require('events').EventEmitter;

var ManagedCache = function() {

	var self = this;
  
	this.store = {};

	this.log = function(str){
		logger.info('[cache] ' + str);
	};

  var getFromID = function(id) {
    var el = self.store[id];
    if (!el) throw "must set cache management functions for "+id +" before getting";
    return el;
  };
  
  /*
    Add cache management functions for id. Don't generate an initial value.
    Emit 'cache_new' on the addition of a generator.
    */
  this.manage = function(id,generate,freshen) {
    if (!generate) throw "Need a generation function for cache entry "+id;
    if (!freshen) {
      freshen = function(cb) {
        cb(false);
      };
    }

    var entry = {time:Date.now(),value:null };
    self.store[id] = {entry:entry,generate:generate,freshen:freshen,freshenIntervalID:-1 };
    self.emit('cache_new',id);
  } ;

  var newValue = function(id,el,callback) {
    el.generate(function(value) {
      self.emit('cache_fresh',id);
      el.entry.value = value;
      el.entry.time = Date.now();
      if (callback) {
        callback(el);
      }
    });
  };

  var cacheAccess = function(id,force,accessor) {
    var el = getFromID(id);
    if (force || !el.entry.value) {
      newValue(id,el,accessor);
    } else {
      el.freshen(function(regenerate) {
        if (regenerate) {
          newValue(id,el,accessor);
        } else {
          accessor(el); // cache hit
        }
      });
    }
  };
  
  /*
    Calls back a value.
  */
  this.value = function(id,force,callback) {
    cacheAccess(id,force,function(el) {
      callback(el.entry.value);
    });
  };

  /*
    Calls back an entry {time:time,value:value}
  */
  this.entry = function(id,force,callback) {
    cacheAccess(id,force,function(el) {
      callback(el.entry);
    });
  };

  /*
    Change freshen function
  */
  this.freshen = function(id,fn,interval) {
    var el = getFromID(id);
    el.freshen = fn;
    if (interval) {
      el.freshenIntervalID = setInterval(function() {
        el.freshen(function(regenerate) {
          if (regenerate) {
            newValue(id,el);
          }
        });
      },interval);
    }
  };

  this.removeFreshen = function(id) {
    var el = getFromID(id);
    el.freshen = function(cb) { cb(false); };
    if (el.freshenIntervalID !== -1) {
      clearInterval(el.freshenIntervalID);
    }
  };
  
};

util.inherits(ManagedCache, Emitter);

module.exports.create = function() {
  return new ManagedCache();
};
