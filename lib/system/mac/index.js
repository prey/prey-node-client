//////////////////////////////////////////
// Prey Node.js Mac Client Functions
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec    = require('child_process').exec,
		common  = require('./../../common'),
		logger  = common.logger,
		airport = require('./airport');

exports.auto_connect = airport.reconnect;

var get_logged_user_cmd = "stat /dev/console | cut -d' ' -f5";
// var get_logged_user_pid_cmd = "ps ax | grep -v grep | grep loginwindow | awk '{print $1}'"

var get_logged_user_pid = function(){
	var cmd = "ps ax | grep loginwindow.app | head -1 | awk '{print $1}'";
	// var cmd = "ps aux | awk -v Var=" + process.env.LOGGED_USER + " '/loginwindow.app/ && match(Var,$1) { print $2 }'";

	exec(cmd, function(err, stdout, stderr){
		process.env.LOGGED_USER_PID = stdout.toString().trim();
		// console.log("Logged user PID is " + process.env.LOGGED_USER_PID);
	});
};

exports.get_logged_user = function(cb){
  exec(get_logged_user_cmd, function(err, out){
    if (err || !out || out.toString().trim() == '')
      return cb(err || new Error("Couldn't find logged user."))

    cb(null, out.toString().trim());
  });
}

exports.get_os_version = function(callback){
	exec('sw_vers -productVersion', function(err, stdout){
		callback(err, stdout ? stdout.toString().trim() : null)
	})
}

exports.process_running = function(process_name, callback){
	var cmd = 'ps ax | grep -v grep | grep -q ' + process_name + ' && echo 1';
	exec(cmd, function(err, stdout, stderr){
		callback(stdout && stdout.toString().trim() == '1')
	});
}

var run_as_logged_user_cmd = function(cmd){

	// if(process.env.LOGGED_USER != process.env.RUNNING_USER)
	//	return 'launchctl bsexec ' + process.env.LOGGED_USER_PID + ' ' + cmd;
	// else
		return cmd;

};
