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
  var geo = load_geo();

  if (!geo.Geolocator)
    return cb(new Error('Unable to load geolocation module: ' + geo.message))
  
  var loc = new geo.Geolocator();
  loc.getGeopositionAsync(function(err, res) {
    if (err || !res.coordinate) 
      return cb(err || new Error('Unable to get location.'))

    // console.log('Got result!');

    var obj = {
      lat: res.coordinate.latitude,
      lng: res.coordinate.longitude,
      accuracy: res.coordinate.accuracy
    }

    cb(null, obj);
  })

}
