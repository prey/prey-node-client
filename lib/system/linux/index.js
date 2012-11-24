"use strict";

//////////////////////////////////////////
// Prey Node.js Linux Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec;

var run_as_logged_user_cmd = function(command){
	if (process.env.LOGGED_USER !== process.env.RUNNING_USER)
		return "DISPLAY=:0 sudo su " + process.env.LOGGED_USER + " -c '" + command + "'";
	else
		return command;
};

/**
 *  Callsback the user logged in.
 **/
exports.get_logged_user = function(callback) {
  var cmd = "ps aux | grep ssh-agent | cut -d' ' -f1 | head -1";
  exec(cmd, function(err, stdout) {
    if (err) return callback(_error("!:"+cmd,err));

    callback(null, stdout.trim());
  });
};

exports.get_os_name = function(callback){
  exec('lsb_release -i', function(err, stdout){
    if(err) return callback(_error("!:" + cmd,err));

    var str = stdout.toString().split(":")[1].trim();
   // str = str.replace('LinuxMint', 'Ubuntu');

    callback(null, str);
  });
};

exports.get_os_version = function(callback){
  exec('lsb_release -r', function(err, stdout){
    if(err) return callback(_error("!:" + cmd, err));

    callback(null, stdout.toString().split(':')[1].trim());
  });
};

exports.process_running = function(process_name, callback){
	var cmd = 'ps ax | grep -v grep | grep -q ' + process_name + ' && echo 1';
	exec(cmd, function(err, stdout){
		callback(stdout && stdout.toString().trim() === '1');
	});
};

// restarts NetworkManager so it reconnects
exports.auto_connect = function(callback){
	var cmd = "service NetworkManager restart";
	exec(cmd, callback);
};


/**
 * Callsback an array of {name,tty}, users currently logged in
 **/
var get_tty_users = function(callback) {
  var cmd = "w -h | awk '{print $1,$2}'";
  exec(cmd,function(err,stdout) {
    if (err) return callback(_error("!:"+cmd,err));

    callback(null,stdout.trim().split('\n').map(function(l) {
      var s = l.split(" ");
      return {name:s[0], tty:s[1]};
    }));
  });
};
