//////////////////////////////////////////
// Prey Node.js Mac Client Functions
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec,
		common = require('./../../common'),
		logger = common.logger;

// var get_logged_user_cmd = "stat /dev/console | cut -d' ' -f5";
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
  exec(exports.get_logged_user_cmd, cb);
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

// we may need to use it right away, so let's fetch it immediately
// exports.get_logged_user_pid();

var run_as_logged_user_cmd = function(cmd){

	// if(process.env.LOGGED_USER != process.env.RUNNING_USER)
	//	return 'launchctl bsexec ' + process.env.LOGGED_USER_PID + ' ' + cmd;
	// else
		return cmd;

};



exports.auto_connect = function(callback){

	var network_service,
			airport_name = '',
			network_setup_cmd = '/usr/sbin/networksetup',
			system = require('./../../plugins/providers/system'),
			network = require('./../../plugins/providers/network');

	var set_airport_names = function(osx_version){
		network_service = "AirPort";

		if(parseFloat(osx_version) >= 10.7){
			network_service = 'Wi-Fi';
			airport_name = 'en1';
		} else if(parseFloat(osx_version) > 10.6){
			airport_name = 'AirPort';
		}

	}

	var toggle_airport = function(direction, cb){
		exec([network_setup_cmd, '-setnetworkserviceenabled', network_service, direction].join(' '), function(err, stdout){
			if(err) return cb(err);
			exec([network_setup_cmd, '-setairportpower', airport_name, direction].join(' '), cb)
		})
	}

	var connect_to_access_point = function(ap, callback){
		var cmd = [network_setup_cmd, '-setairportnetwork', airport_name, ap.ssid].join(' ');
		exec(cmd, callback);
	}

	system.get('os_version', function(err, version){

		if(err) return callback(err);
		set_airport_names(version);

		logger.debug('Toggling Airport off...');
		toggle_airport('off', function(err){
			if(err) return callback(err);

			logger.debug('Toggling Airport back on...');
			toggle_airport('on', function(err){
				if(err) return callback(err);

				logger.debug('Getting list of open Wifi access points...');
				network.get('open_access_points_list', function(err, list){

					if(err) return callback(err);
					logger.debug('Connecting to ' + list[0] + '...');
					connect_to_access_point(list[0], callback);

				});

			});

		});

	});

}
