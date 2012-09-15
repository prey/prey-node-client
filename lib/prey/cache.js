//////////////////////////////////////////
// Prey Actions Cache Class
// (c) 2011 - Fork Ltd.
// by Ritchie Turner - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		util = require('util'),
		Emitter = require('events').EventEmitter;

var Cache = function() {

	var self = this;
  
	this.store = {};

	this.log = function(str){
		logger.info('[cache] ' + str);
	};

  this.on = function(id,callback){
  };

  var getFromID = function(id) {
    var el = self.store[id];

    if (el === null) {
      throw "must set cache management functions for "+id +" before getting";
    }

    return el;
  };
  
  /*
    Add cache management functions for id. Don't generate an initial value.
    */
  this.set = function(id,generate,freshen) {

    if (!generate) {
      throw "Need a generation function for cache entry "+id;
    }

    if (!freshen) {
      freshen = function(cb) {
        cb(false);
      };
    }

    var entry = {time:Date.now(),value:null };
    self.store[id] = {entry:entry,generate:generate,freshen:freshen,freshenIntervalID:-1 };
  } ;

  var cacheAccess = function(id,force,accessor) {
    var el = getFromID(id);
    if (force || !el.entry.value) {
      el.generate(function(value) {
        el.entry.value = value;
        el.entry.time = Date.now();
        accessor(el);
      });
    } else {
      el.freshen(function(regenerate) {
        if (regenerate) {
          el.generate(function(value) {
            el.entry.value = value;
            el.entry.time = Date.now();
            accessor(el);
          });
        } else {
          console.log("CACHE HIT:"+id);
          accessor(el);
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
            el.generate(function(value) {
              el.entry.value = value;
              el.entry.time = Date.now();
            });
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


util.inherits(Cache, Emitter);

module.exports.create = function() {
  return new Cache();
};
