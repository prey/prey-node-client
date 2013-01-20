var exec = require('child_process').exec;

exports.reconnect = function(callback){

	var network_service,
			airport_name = '',
			network_setup_cmd = '/usr/sbin/networksetup',
			providers = require('./../../agent/providers');

	var set_airport_names = function(osx_version){
		network_service = "AirPort";

		if (parseFloat(osx_version) >= 10.7){
			network_service = 'Wi-Fi';
			airport_name = 'en1';
		} else if(parseFloat(osx_version) > 10.6){
			airport_name = 'AirPort';
		}

	}

	var toggle_airport = function(direction, cb){
		exec([network_setup_cmd, '-setnetworkserviceenabled', network_service, direction].join(' '), function(err, stdout){
			if (err) return cb(err);
			exec([network_setup_cmd, '-setairportpower', airport_name, direction].join(' '), cb)
		})
	}

	var connect_to_access_point = function(ap, callback){
		var cmd = [network_setup_cmd, '-setairportnetwork', airport_name, ap.ssid].join(' ');
		exec(cmd, callback);
	}

	require('./').get_os_version(function(err, version){

		if (err) return callback(err);
		set_airport_names(version);

		// logger.debug('Toggling Airport off...');
		toggle_airport('off', function(err){
			if (err) return callback(err);

			// logger.debug('Toggling Airport back on...');
			toggle_airport('on', function(err){
				if (err) return callback(err);

				// logger.debug('Getting list of open Wifi access points...');
				providers.get('open_access_points_list', function(err, list){

					if (err) return callback(err);
					// logger.debug('Connecting to ' + list[0] + '...');
					connect_to_access_point(list[0], callback);

				});

			});

		});

	});

}
