var fs     = require('fs'),
    join   = require('path').join,
    xml2js = require('xml2js'),
    exec   = require('child_process').exec,
    wifion = join(__dirname, 'bin', 'wifion'),
    tmpdir = process.platform == 'win32' ? process.env.WINDIR + '\\Temp' : '/tmp';

var profile_json = {
  "WLANProfile":{
    "$":{
      "xmlns":"http://www.microsoft.com/networking/WLAN/profile/v1"
    },
    "name":null,
    "SSIDConfig":[{
      "SSID":
        [{
          "hex":null,
          "name":null
        }]
    }],
    "connectionType":["ESS"],
    "connectionMode":["manual"],
    "MSM":[{
      "security":[{
        "authEncryption":[{
          "authentication":["open"],
          "encryption":["none"],
          "useOneX":["false"]
        }]
      }]
    }],
    "MacRandomization":[{
      "$":{
        "xmlns":"http://www.microsoft.com/networking/WLAN/profile/v3"
      },
      "enableRandomization":["false"]
    }]
  }
}

var generate_xml = function(ssid, cb) {
  var profile = profile_json;
  profile.WLANProfile.name = [ssid];
  profile.WLANProfile.SSIDConfig[0].SSID[0].hex = [Buffer.from(ssid, 'utf8').toString('hex').toUpperCase()];
  profile.WLANProfile.SSIDConfig[0].SSID[0].name = [ssid];

  var builder = new xml2js.Builder(),
      xml = builder.buildObject(profile);

  fs.writeFile(join(tmpdir, `PreyWiFi-${ssid}.xml`), xml, function(err) {
    return cb && cb(err);
  })
}

exports.enable_wifi = function(cb) {
  exec(wifion, function(err) {
    return cb();
  });
}

var delete_xml = function(ssid, cb) {
  var file = join(tmpdir, `PreyWiFi-${ssid}.xml`);
  fs.unlink(file, function(err) {
    return cb && cb(err);
  })
}

exports.get_existing_profiles = function(cb) {
  exec('netsh wlan show profiles', function(err, data) {
    var lines = data.toString().split('\n');
    var profiles = [];

    lines.forEach(function(line) {
      if (line.includes('All User Profile     :')) {
        var profile = line.split(': ').pop();
        profiles.push(profile.trim());
      }
    })

    cb(null, profiles);
  })
}

exports.create_profile = function(ssid, cb) {
  var file = join(tmpdir, `PreyWiFi-${ssid}.xml`);

  generate_xml(ssid, function(err) {
    if (err) return cb(err);
    exec(`netsh wlan add profile filename="${file}" user=all`, function(err, stdout) {
      return cb && cb(err);
    })
  })
}

exports.delete_profile = function(ssid, cb) {
  delete_xml(ssid, function(err) {
    exec(`netsh wlan delete profile "${ssid}"`, function(err, stdout) {
      return cb && cb(err);
    })
  });
}

exports.connect_to_ap = function(ssid, cb) {  // revisar cb si va
  exec(`netsh wlan connect name="${ssid}"`, function(err, out) {
    return cb(err, out);
  });
}