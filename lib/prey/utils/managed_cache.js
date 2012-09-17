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

  Generation of element is on first value/entry request, not on registration of
  element. To register an element, e.g.

  cache.manage("nics",wmic.nicListFull);

  To get a value

  cache.value("nics",function(val) { });

  To get an entry (with time generated)

  cache.entry("nics",function(entry) {}); // {time:time,value:value}
  
  Cache element generation is serialized as it's likely to be async. This guards
  against the possibility of multiple requests to the same id, before a previous
  request has been satisfied, which will lead to superflous requests.

  Serialization is per element.

  You can add listeners for:

  cache_new   - fired on addition of a new element
  cache_fresh - fired on new value has been generated
  cache_hit   - fired on access of an existing element

  each provides the id of the element in the callback.
  
*/

var
  util = require('util'),
  async = require('async'),
  Emitter = require('events').EventEmitter;

var ManagedCache = function() {

	var self = this;

	this.store = {};

  this.keys = function() {
    return Object.keys(this.store);
  };

  var getFromID = function(id) {
    var el = self.store[id];
    if (!el) throw new Error("Must set cache management functions for "+id +" before getting");
    return el;
  };

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

  /*
    Add cache management functions for id. Don't generate an initial value.
    Emit 'cache_new' on the addition of a generator.
    */
  this.manage = function(id,generate,freshen) {
    if (!generate) throw new Error("Need a generation function for cache entry "+id);
    if (!freshen) {
      // default, don't freshen
      freshen = function(cb) {
        cb(false);
      };
    }

    var entry = {time:Date.now(),value:null };

    var accessQ = async.queue(function(force,accessor) {
      var el = getFromID(id);

      if (force || !el.entry.value) {
        newValue(id,el,accessor);
      } else {
        el.freshen(function(regenerate) {
          if (regenerate) {
            newValue(id,el,accessor);
          } else {
            self.emit('cache_hit',id);
            accessor(el); 
          }
        });
      }
    },1);
    
    self.store[id] = {entry:entry,
                      generate:generate,
                      freshen:freshen,
                      freshenIntervalID:-1,
                      accessQ:accessQ };
    
    self.emit('cache_new',id);
  } ;
  
  /*
    Calls back a value.
  */
  this.value = function(id,force,callback) {
    if(typeof callback === 'undefined') {
      if (typeof force === 'function') {
			  callback = force;
        force = false;
      } else throw new Error("ManagedCache.value: No callback supplied");
    }

    getFromID(id).accessQ.push(force,function(el) {
      callback(el.entry.value);
    });
  };
  
  /*
    Calls back an entry {time:time,value:value}
  */
  this.entry = function(id,force,callback) {
    if(typeof callback === 'undefined') {
      if (typeof force === 'function') {
			  callback = force;
        force = false;
      } else throw new Error("ManagedCache.entry: No callback supplied");
    }

    getFromID(id).accessQ.push(force,function(el) {
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
        el.accessQ.push({id:id,force:false},function() {});
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

module.exports.stats = function(cache) {

  var hitsById = {};
  var freshById = {};
  
  cache.on('cache_hit',function(id) {
    if (!hitsById[id])
      hitsById[id] = 0;
    hitsById[id]++;
  });

  cache.on('cache_fresh',function(id) {
    if (!freshById[id])
      freshById[id] = 0;
    freshById[id]++;
  });

  
  return function() {
    return {
    nKeys:cache.keys().length,
    keys:cache.keys(),
    hitsById:hitsById,
    freshById:freshById
    }
  };

};
