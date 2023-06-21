// geolocation provider using geoclue service

var exec = require('child_process').exec;

/*

valid dbus reply format:

  int32     # number of fields
  int32     # timestamp
  double    # lat
  double    # lng
  double    # altitude
  struct {  # accuracy
    int32 3
    double 0
    double 0
  }

*/

function parse(out, cb) {
  var matches = out.match(/double ([\d\.-]+)/g);
  if (matches < 2)
    return cb(new Error('Unable to get location.'))

  var res = {
    lat: parseFloat(matches[0].replace('double ', '')),
    lng: parseFloat(matches[1].replace('double ', '')),
    altitude: parseFloat(matches[2].replace('double ', ''))
  }

  cb(null, res);
}

function get_command_one(provider) {
  var bin     = 'dbus-send',
      service = 'org.freedesktop.Geoclue.Providers.' + provider,
      path    = '/org/freedesktop/Geoclue/Providers/' + provider,
      command = 'org.freedesktop.Geoclue.Position.GetPosition';

  return [bin, '--print-reply', '--dest=' + service, path, command].join(' ');
}

function geoclue_one(provider, cb) {
  var cmd = get_command_one(provider);

  exec(cmd, function(err, out) {
    if (err) return cb(err);

    parse(out, cb);
  })
}

function get_command_two() {
  var bin     = 'dbus-send',
      service = 'org.freedesktop.GeoClue2',
      path    = '/org/freedesktop/GeoClue2',
      command = 'org.freedesktop.GeoClue2.Location';

  return [bin, '--print-reply', '--dest=' + service, path, command].join(' ');
}

function geoclue_two(cb) {
  exec(get_command_two, function(err, out) {
    if (err) return cb(err);

    parse(out, cb);
  })
}

exports.get_location = function(cb) {
  geoclue_two(function(err, res) {
    if (res) return cb(null, res);

    geoclue_one('Skyhook', function(err, res) {
      if (res) return cb(null, res);
    });
  })
}