var common = require('./../../../common');

var geo;

function load_geo() {
  if (geo)
    return geo;

  try {
    geo = require('./windows.devices.geolocation');
    return geo;
  } catch(e) {
    return e;
  }
}

exports.get_location = function(cb) {
  // Force networks re-scan to avoid empty APs list
  common.system.scan_networks(function() {
    var geo = load_geo();

    if (!geo.Geolocator)
      return cb(new Error('Unable to load geolocation module: ' + geo.message))

    function locate() {
      var loc = new geo.Geolocator();

      loc.getGeopositionAsync(function(err, res) {
        if (err || !res.coordinate)
          return cb(err || new Error('Unable to get location.'))

        var obj = {
          lat: res.coordinate.latitude,
          lng: res.coordinate.longitude,
          accuracy: res.coordinate.accuracy
        }

        cb(null, obj);
      });
    }

    locate();
  })
}
