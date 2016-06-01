"use strict";

////////////////////////////////////////////
// (c) 2016 Prey, Inc.
// By Javier Acuña - http://preyproject.com
// GPLv3 Licensed
////////////////////////////////////////////

var path = require('path');
var common = require('./../../common'),
    logger = common.logger;

var fs = require("fs");

var exec = require('child_process').exec;

//}
fs.stat(path.join(__dirname,'lock-pre.xml'), function(err, stat){
  if (err)
    console.log("STAT:", stat, err)
  else
    rename_xml();
})

var rename_xml = function() {
  fs.rename(path.join(__dirname,'lock-pre.xml'), path.join(__dirname,'lock-win.xml'), function(err) {
    if (err) console.log('ERROR: ' + err);
  });
}

exports.add_task = function(cb) {
  var cmd  = "schtasks /create /tn 'ShowDesktop' /xml " + path.join(__dirname, 'lock-win.xml') + " /tr " + path.join(__dirname, 'desktop.scf') + " /sc onlogon";
  exec(cmd, function(err, stdout) {
    cb();
  });
}

exports.remove_task = function() {
  
}



// module.exports.get_users_list = function(cb) {
//   exec(cmd, function(err, stdout) {
//     cb(err, stdout.split("\n").slice(1, -2));
//   });
// };
