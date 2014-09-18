var exec = require('child_process').exec;
var network_setup_cmd = '/usr/sbin/networksetup';

function more_descriptive_error(err, out) {
  err.message = 'Unable to reconnect. ' + err.message;
  if (out && out.toString().trim() != '')
    err.message += ' ' + out;

  return err;
}

exports.reconnect = function(done) {

  var network_service,
      airport_name = '',
      providers    = require('./../../agent/providers');

  var set_airport_names = function(osx_version) {
    network_service = "AirPort";

    if (parseFloat(osx_version) >= 10.7){
      network_service = 'Wi-Fi';
      airport_name    = 'en1';
    } else if(parseFloat(osx_version) > 10.6){
      airport_name    = 'AirPort';
    }
  }

  var toggle_airport = function(direction, cb) {
    var cmd = [network_setup_cmd, '-setnetworkserviceenabled', network_service, direction].join(' '); 
    exec(cmd, function(err, out) {
      if (err) return cb(err, out);

      var cmd = [network_setup_cmd, '-setairportpower', airport_name, direction].join(' ');
      exec(cmd, cb)
    })
  }

  var connect_to_access_point = function(ap, cb) {
    var cmd = [network_setup_cmd, '-setairportnetwork', airport_name, ap.ssid].join(' ');
    exec(cmd, cb);
  }

  // logger.debug('Getting list of open Wifi access points...');
  providers.get('open_access_points_list', function(err, list) {
    if (err || !list[0]) return done(err || new Error('No open access point found.'));

    require('./').get_os_version(function(err, version) {
      if (err) return done(err); // this shouldn't fail

      set_airport_names(version);

      // logger.debug('Toggling Airport off...');
      toggle_airport('off', function(err, out) {
        if (err) return done(more_descriptive_error(err, out));

        // logger.debug('Toggling Airport back on...');
        toggle_airport('on', function(err, out) {
          if (err) return done(more_descriptive_error(err, out));

          // logger.debug('Connecting to ' + list[0] + '...');
          connect_to_access_point(list[0], done);
        });

      });

    });

  });

}
