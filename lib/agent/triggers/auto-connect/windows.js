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

var generate_xml = (ssid, cb) => {
  var profile = profile_json;
  profile.WLANProfile.name = [ssid];
  profile.WLANProfile.SSIDConfig[0].SSID[0].hex = [Buffer.from(ssid, 'utf8').toString('hex').toUpperCase()];
  profile.WLANProfile.SSIDConfig[0].SSID[0].name = [ssid];

  var builder = new xml2js.Builder(),
      xml = builder.buildObject(profile);

  fs.writeFile(join(tmpdir, `PreyWiFi-${ssid}.xml`), xml, (err) => {
    return cb && cb(err);
  })
}

exports.enable_wifi = (cb) => {
  exec(wifion, (err) => {
    return cb();
  });
}

var delete_xml = (ssid, cb) => {
  var file = join(tmpdir, `PreyWiFi-${ssid}.xml`);
  fs.unlink(file, (err) => {
    return cb && cb(err);
  })
}

exports.get_existing_profiles = (cb) => {
  exec('netsh wlan show profiles', (err, data) => {
    var lines = data.toString().split('\n');
    var profiles = [];

    lines.forEach((line) => {

      if (line.includes('All User Profile     :')) {
        var profile = line.split(': ').pop();
        profiles.push(profile.trim());
      }
    })

    cb(null, profiles);
  })
}

exports.create_profile = (ssid, cb) => {
  var file = join(tmpdir, `PreyWiFi-${ssid}.xml`);

  generate_xml(ssid, (err) => {
    if (err) return cb(err);
    exec(`netsh wlan add profile filename="${file}" user=all`, (err, stdout) => {
      return cb && cb(err);
    })
  })
}

exports.delete_profile = (ssid, cb) => {
  delete_xml(ssid, (err) => {
    exec(`netsh wlan delete profile "${ssid}"`, (err, stdout) => {
      return cb && cb(err);
    })
  });
}

exports.connect_to_ap = (ssid, cb) => {  // revisar cb si va
  exec(`netsh wlan connect name="${ssid}"`, (err, out) => {
    return cb(err, out);
  });
}