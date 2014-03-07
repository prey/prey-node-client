"use strict";

//////////////////////////////////////////
// Prey Node.js Linux Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec;

exports.sudo = require('./sudo');

var lsb_release = function(option, cb) {
  exec('lsb_release ' + option + ' -s', function(err, stdout){
    if (err) return cb(err);
    cb(null, stdout.toString().trim());
  });
}

/**
 *  Callsback the user logged in.
 **/
exports.find_logged_user = function(callback) {
  var cmd = "export PS_FORMAT=user:16,command; ps ax | grep ssh-agent | grep -v grep | cut -d' ' -f1 | head -1";
  exec(cmd, function(err, stdout) {
    if (err) return callback(err);

    callback(null, stdout.trim());
  });
};

exports.get_os_name = function(cb) {
  lsb_release('-i', function(err, name){
    if (err && !name)
      return cb(err || new Error("Couldn't get OS name."));

    cb(null, name);
  })
};

exports.get_os_version = function(cb) {
  lsb_release('-r', function(err, ver) {
    if (err || !ver)
      return cb(err || new Error("Couldn't determine version."));

    cb(null, ver);
  })
};

exports.process_running = function(process_name, callback){
  var cmd = 'ps ax | grep -v grep | grep -q ' + process_name + ' && echo 1';
  exec(cmd, function(err, stdout){
    callback(stdout && stdout.toString().trim() === '1');
  });
};

// restarts NetworkManager so it reconnects
exports.reconnect = function(callback){
  var cmd = "service NetworkManager restart";
  exec(cmd, callback);
};


/**
 * Callsback an array of {name,tty}, users currently logged in
 **/
 /*
var get_tty_users = function(callback) {
  var cmd = "w -h | awk '{print $1,$2}'";
  exec(cmd,function(err, stdout) {
    if (err) return callback(err);

    callback(null,stdout.trim().split('\n').map(function(l) {
      var s = l.split(" ");
      return {name: s[0], tty: s[1]};
    }));
  });
};
*/
