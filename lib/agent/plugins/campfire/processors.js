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
  
    return resp && resp.url ? cb(null, resp.url) : new Error("Couldn't get image URL.");
  })
}

exports.location = function(location, cb) {
  if (!location || !location.lat)
    return '';

  opts = opts || {};
 
  var params  = {
    zoom    : opts.zoom || 15,
    size    : opts.size || '512x512',
    maptype : opts.maptype || 'roadmap'
  }

  var coords = [location.lat, location.lng].join(','),
      string = Object.keys(params).map(function(key) { return key + '=' + params[key] }).join('&');

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