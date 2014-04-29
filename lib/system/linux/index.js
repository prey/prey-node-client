"use strict";

//////////////////////////////////////////
// Prey Node.js Linux Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var release = require('os').release,
    exec    = require('child_process').exec;

exports.sudo = require('./sudo');

var lsb_release = function(option, cb) {
  exec('lsb_release ' + option + ' -s', function(err, stdout){
    if (err) return cb(err);
    cb(null, stdout.toString().trim());
  });
}

var get_issue = function(filter_cb, cb) {
  var cmd = 'cat /etc/issue | head -1';
  exec(cmd, function(err, out) {
    if (err) return cb(err);
    cb(null, filter_cb(out.toString()).trim());
  });
}

var get_distro_info = function(what, lsb_param, issue_cb, cb) {
  lsb_release(lsb_param, function(err, name) {
    if (name && name != '')
      return cb(null, name);

    get_issue(issue_cb, function(err, name) {
      if (err || !name)
        return cb(err || new Error("Couldn't get distro " + what + "."));

      cb(null, name);
    })
  })
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
  var issue_cb = function(out) { return out.replace(/\d.*/, "") };
  get_distro_info('name', '-i', issue_cb, function(err, name) {
    var name = (name || 'Linux').replace(/LinuxMint|Elementary OS/, 'Ubuntu');
    cb(err, name);
  });
};

exports.get_os_version = function(cb) {
  var issue_cb = function(out) { return out.replace(/[^0-9\.]/g, '') };
  get_distro_info('version', '-r', issue_cb, function(err, ver) {
    cb(err, ver || release()); // fallback to kernel version
  });
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
