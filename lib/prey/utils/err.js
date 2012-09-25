
"use strict";

var logger;
var	util = require('util');
var Emitter = require('events').EventEmitter;

/*
  Assumes a logger with a log/info/warn etc.
*/

Function.prototype.ErrOrValid = function(f,v) {
  if (f!=null) {
    this.apply(this,[f,null]);
    return false;
  }
  
  this.apply(this,[null,v]);
  return true;
};

var errs = {};

errs._set = function(code,msg) {
  errs[code] = {code:code,msg:msg}; 
};

errs._new = function(code,context) {
  if(!errs[code])
    throw "Don't have error "+code+" registered";

  var m = code + ": "+ errs[code].msg+": "+context;
  console.log(m);
  
  return { err:code, context:context,msg:errs[code].msg };
};

module.exports = errs;
