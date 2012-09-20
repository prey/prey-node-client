
"use strict";

var logger;
var	util = require('util');
var Emitter = require('events').EventEmitter;

/*
  Assumes a logger with a log/info/warn etc.
*/

function Err() {
  var self = this;
  
  this.errs = {};
  this.logger = null;
  this.failureMode = "fast";
  
  this.setLogger = function(lgr) {
    logger = lgr;
  };

  this.when = function(mode) {
    self.failureMode = mode;
  };

  this.set = function(code,msg,failmode) {
    if (!code || !msg) {
      throw new Error("You must provide a code and a message for an error");
    }
    
    if (!failmode) {
      failmode = "fast";
    }

    if (!self.errs[code])
      self.errs[code] = {msg:msg,failMode:failmode};
    else
      throw new Error('Error code '+code+' is already registered');
  };

  this.check = function(code,err,context,callback) {

    if (!logger) {
      throw new Error("Err: Logger not set!");
    }
    
    if (!err) {
      return true;
    }
    
    var e = self.errs[code];  
    
    if (!e) {
      throw "Err: Don't know error: "+code;
    }

    if (!context) {
      context = "No context provided";
    }
    
    // always emit a notifcation for any interested parties
    self.emit(code,e,context);
    
    if (callback) { // callback provides a local means of overriding default behaviour
      return callback(e);
    } else {

      var msg = code + ' : ' + e.msg + ' : ' + context;
      
      if (self.failureMode === "fast") {
        throw new Error(msg);
      }
      
      if (self.failureMode === "optional") {
        if (e.failmode === "optional") {
          logger.log(msg);
          return true;
        } else {
          throw new Error(msg);
        }
      }
    }
  };

}

util.inherits(Err, Emitter);
module.exports = new Err();
