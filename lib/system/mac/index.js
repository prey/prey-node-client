//////////////////////////////////////////
// Prey Node.js Mac Client Functions
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec    = require('child_process').exec,
    airport = require('./airport'),
    os_name = process.platform.replace('darwin', 'mac');

exports.reconnect = airport.reconnect;

// var get_logged_user_cmd = "stat /dev/console | cut -d' ' -f5";
// var get_logged_user_pid_cmd = "ps ax | grep -v grep | grep loginwindow | awk '{print $1}'"
//var get_logged_users_cmd = "ps aux | grep -v grep | grep loginwindow | awk '{print $1}'"
var get_logged_users_cmd = "stat -f%Su /dev/console"

var get_logged_user_pid = function(){
	var cmd = "ps ax | grep loginwindow.app | head -1 | awk '{print $1}'";
	// var cmd = "ps aux | awk -v Var=" + process.env.LOGGED_USER + " '/loginwindow.app/ && match(Var,$1) { print $2 }'";

	exec(cmd, function(err, stdout, stderr){
		process.env.LOGGED_USER_PID = stdout.toString().trim();
		// console.log("Logged user PID is " + process.env.LOGGED_USER_PID);
	});
};

exports.find_logged_user = function(cb){
  exec(get_logged_users_cmd, function(err, out){
    if (err) return cb(err)

    var items = out.split('\n');
    if (items[0] == '')
      return cb(new Error("Couldn't find logged user."))

    var non_root = items.filter(function(x){ return x != '' && x != 'root' });

    if (non_root.length > 0)
      return cb(null, non_root[0]);
    else
      return cb(null, items[0]);
  });
}

exports.get_os_name = function(cb) {
  cb(null, os_name);
}

exports.get_os_version = function(cb) {
	exec('sw_vers -productVersion', function(err, stdout){
		cb(err, stdout && stdout.toString().trim())
	})
}

exports.process_running = function(process_name, callback){
	var cmd = 'ps ax | grep -v grep | grep -q ' + process_name + ' && echo 1';
	exec(cmd, function(err, stdout, stderr){
		callback(stdout && stdout.toString().trim() == '1')
	});
}
