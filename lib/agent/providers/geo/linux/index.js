// geolocation provider using geoclue service

const { exec } = require('child_process');

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
  const matches = out.match(/double ([\d\.-]+)/g);
  if (!matches || matches.length < 2) return cb(new Error('Unable to get location.'));

  const res = {
    lat: parseFloat(matches[0].replace('double ', '')),
    lng: parseFloat(matches[1].replace('double ', '')),
    altitude: matches[2] ? parseFloat(matches[2].replace('double ', '')) : undefined,
  };

  cb(null, res);
}

function get_command_one(provider) {
  const bin = 'dbus-send';
  const service = `org.freedesktop.Geoclue.Providers.${provider}`;
  const path = `/org/freedesktop/Geoclue/Providers/${provider}`;
  const command = 'org.freedesktop.Geoclue.Position.GetPosition';

  return [bin, '--print-reply', `--dest=${service}`, path, command].join(' ');
}

function geoclue_one(provider, cb) {
  const cmd = get_command_one(provider);

  exec(cmd, { timeout: 30000 }, (err, out) => {
    if (err) return cb(err);

    parse(out, cb);
  });
}

function get_command_two() {
  const bin = 'dbus-send';
  const service = 'org.freedesktop.GeoClue2';
  const path = '/org/freedesktop/GeoClue2';
  const command = 'org.freedesktop.GeoClue2.Location';

  return [bin, '--print-reply', `--dest=${service}`, path, command].join(' ');
}

function geoclue_two(cb) {
  exec(get_command_two(), { timeout: 30000 }, (err, out) => {
    if (err) return cb(err);

    parse(out, cb);
  });
}

exports.get_location = function (cb) {
  geoclue_two((err, res) => {
    if (res) return cb(null, res);

    geoclue_one('Skyhook', (err, res) => {
      if (res) return cb(null, res);

      geoclue_one('UbuntuGeoIP', cb);
    });
  });
};

const askLocationNativePermission = (cb) => {
  if (typeof cb === 'function') cb();
};

exports.askLocationNativePermission = askLocationNativePermission;
