exports.location = function(location, opts) {
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

  return url;
}