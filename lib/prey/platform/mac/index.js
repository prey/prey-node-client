//////////////////////////////////////////
// Prey Node.js Mac Client Functions
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var exec = require('child_process').exec,
		common = require('./../../common'),
		logger = common.logger,
		script_path = common.script_path,
		random_between = require('./../../helpers').random_between;

exports.temp_path = '/tmp';
exports.default_config_path = '/etc/prey'; // /usr/local/etc/prey
exports.log_file_path = '/var/log/prey.log';

exports.get_logged_user_pid = function(){
	
	var cmd = "ps ax | grep loginwindow.app | head -1 | awk '{print $1}'";
	// var cmd = "ps aux | awk -v Var=" + process.env.LOGGED_USER + " '/loginwindow.app/ && match(Var,$1) { print $2 }'";

	exec(cmd, function(err, stdout, stderr){
		process.env.LOGGED_USER_PID = stdout.toString().trim();
		// console.log("Logged user PID is " + process.env.LOGGED_USER_PID);
	});

};

// we may need to use it right away, so let's fetch it immediately
// exports.get_logged_user_pid();

exports.run_as_logged_user_cmd = function(cmd){

	// if(process.env.LOGGED_USER != process.env.RUNNING_USER)
	//	return 'launchctl bsexec ' + process.env.LOGGED_USER_PID + ' ' + cmd;
	// else
		return cmd;

};

exports.get_current_delay = function(callback) {

	var delay_value;

	exec('crontab -l', function(err, stdout, stderr){

		if(err) return callback({value: null});
		var lines = stdout.toString().trim().split("\n");

		lines.forEach(function(el){
			if(el.indexOf(script_path) != -1)
				delay_value = el.replace(/ \*.*/, ''); // .replace('*/', '');
		});
		
		if (!delay_value) return callback({value: null});
		
		var delay = {
			value: delay_value.replace('*/', ''),
			one_hour: delay_value.indexOf('*/') == -1 
		}

		callback(delay);

	});

};

exports.set_new_delay = function(new_delay, callback){
	
	var delay_string = parseInt(new_delay) == 60 ? random_between(1, 59) : "*/" + new_delay;

	var cmd = 'crontab -l | grep -v "' + script_path + '"; \
	echo "' + delay_string + " * * * * " + script_path + ' &> /dev/null" | crontab -'

	exec(cmd, callback);

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
