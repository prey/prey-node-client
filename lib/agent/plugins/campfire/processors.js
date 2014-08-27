var needle = require('needle');

function upload_image(obj, cb) {
  var url = 'http://deviantsart.com';

  var opts = { 
    timeout:  10000, 
    follow:    true, 
    multipart: true
  };

  var data = {
    file: obj
  }

  needle.post(url, data, opts, function(err, resp) {
    if (err) return cb(err);
  
    var data;
    try { data = JSON.parse(resp.body) } catch(e) { }

    return data && data.url ? cb(null, data.url) : cb(new Error("Couldn't get image URL."));
  })
}

exports.location = function(location, cb) {
  if (!location || !location.lat)
    return '';

  var opts = {}; // eventually we'll have a way of passing them
 
  var coords = [location.lat, location.lng].join(',');

  var params  = {
    zoom    : opts.zoom || 15,
    size    : opts.size || '512x512',
    maptype : opts.maptype || 'roadmap'
  }

  // static maps are not being shown in Campfire, because they don't end with a jpg/png extension.
  // so let's just send the google maps link with the coordinates.
  return 'https://maps.google.com?q=' + coords;

  var string = Object.keys(params).map(function(key) { return key + '=' + params[key] }).join('&');
  var url    = 'http://maps.googleapis.com/maps/api/staticmap?sensor=true&';
      url   += string + '&markers=color:blue%7Clabel:X%7C' + coords;

  cb(url);
}

exports.picture = function(obj, cb) {
  upload_image(obj, function(err, link) {
    cb(link)
  })
}

exports.screenshot = function(obj, cb) {
  upload_image(obj, function(err, link) {
    cb(link)
  })
}