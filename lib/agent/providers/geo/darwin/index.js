var join   = require('path').join,
    exec   = require('child_process').exec,
    system = require('../../../common').system,
    semver = require('semver');

function to_semver(str) {
  var len = str.toString().split('.').length,
      suffix = new Array(4 - len).join('.0');

  return str + suffix;
}

// whereami bin from https://github.com/robmathers/WhereAmI
var bin = join(__dirname, 'bin', 'whereami');

var get_using_corelocation = function(cb) {

  exec(bin, function(err, out) {
    if (err) return cb(err);

    if (!out.toString().match('Latitude'))
      return cb(new Error('Unable to get geoposition data using CoreLocation.'));

    var match, str = out.toString();

    var res = {
      lat: str.match(/Latitude: (.+)/)[1],
      lng: str.match(/Longitude: (.+)/)[1]
    }

    if (match = str.match(/\nAccuracy.*: (.+)/)) {
      res.accuracy = match[1];
    } else if (match = str.match(/Horizontal Accuracy.*: (.+)/)) {
      res.accuracy = match[1];
      res.vertical_accuracy = str.match(/Vertical Accuracy.*: (.+)/)[1];
      res.altitude = str.match(/Altitude.*: (.+)/)[1];
    }

    cb(null, res);
  })

}

exports.get_location = function(cb) {

  system.get_os_version(function(err, version) {
    if (version && semver.gt(to_semver(version), '10.6.0'))
      return get_using_corelocation(cb);

    cb(new Error('CoreLocation not suppored in OSX ' + version))
  });

}