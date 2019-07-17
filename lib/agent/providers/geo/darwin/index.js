var join          = require('path').join,
    app           = join(__dirname, '..', '..', '..', 'utils', 'Prey.app'),
    child_process = require('child_process'),
    common        = require('../../../common'),
    system        = common.system,
    run_as_user   = system.run_as_logged_user,
    gte           = common.helpers.is_greater_or_equal;

// whereami bin from https://github.com/robmathers/WhereAmI
var bin = join(__dirname, 'bin', 'whereami');

var get_using_corelocation = function(cb) {
  child_process.exec(bin, function(err, out) {
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
  });
}

exports.get_location = function(cb) {
  system.get_os_version((err, version) => {
    if (version && gte(version, "10.6.0")) {
      var bin  = join(app, 'Contents', 'MacOS', 'Prey'),
          args = ['-location'];

      run_as_user(bin, args, {timeout: 5000}, (err, data) => {
        if (err || (data && data.includes('error'))) return cb(new Error('Unable to get native location'));
        return cb(null, JSON.parse(data))
      })

    } else {
      return cb(new Error('Not yet supported'));
    }
  });
}