/*
 Latitude/longitude spherical geodesy formulae & scripts (c) Chris Veness 2002-2011
 www.movable-type.co.uk/scripts/latlong.html
*/

var LatLon = function(lat, lon, rad) {
  if (typeof(rad) == 'undefined') rad = 6371;  // earth's mean radius in km
  // only accept numbers or valid numeric strings
  this._lat = typeof(lat)=='number' ? lat : typeof(lat)=='string' && lat.trim()!='' ? +lat : NaN;
  this._lon = typeof(lon)=='number' ? lon : typeof(lon)=='string' && lon.trim()!='' ? +lon : NaN;
  this._radius = typeof(rad)=='number' ? rad : typeof(rad)=='string' && trim(lon)!='' ? +rad : NaN;
}

LatLon.prototype.distanceTo = function(point, precision) {
  // default 4 sig figs reflects typical 0.3% accuracy of spherical model
  if (typeof precision == 'undefined') precision = 4;

  var R = this._radius;
  var lat1 = toRad(this._lat), lon1 = toRad(this._lon);
  var lat2 = toRad(point._lat), lon2 = toRad(point._lon);
  var dLat = lat2 - lat1;
  var dLon = lon2 - lon1;

  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1) * Math.cos(lat2) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c;
  return toPrecisionFixed(d, precision);
}

var toRad = function(number) {
  return number * Math.PI / 180;
}

var toPrecisionFixed = function(number, precision) {
  if (isNaN(number)) return 'NaN';
  var numb = number < 0 ? -number : number;  // can't take log of -ve number...
  var sign = number < 0 ? '-' : '';

  if (numb == 0) {  // can't take log of zero, just format with precision zeros
    var n = '0.';
    while (precision--) n += '0';
    return n
  }

  var scale = Math.ceil(Math.log(numb)*Math.LOG10E);  // no of digits before decimal
  var n = String(Math.round(numb * Math.pow(10, precision-scale)));
  if (scale > 0) {  // add trailing zeros & insert decimal as required
    l = scale - n.length;
    while (l-- > 0) n = n + '0';
    if (scale < n.length) n = n.slice(0,scale) + '.' + n.slice(scale);
  } else {          // prefix decimal and leading zeros if required
    while (scale++ < 0) n = '0' + n;
    n = '0.' + n;
  }
  return sign + n;
}

module.exports = LatLon;