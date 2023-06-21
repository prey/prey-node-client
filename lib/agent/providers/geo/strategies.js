"use strict"

var join      = require('path').join,
    needle    = require('needle'),
    platform  = require(join(__dirname, process.platform)),
    common    = require('./../../common'),
    config    = common.config,
    providers = require('./../../providers'),
    keys      = require('./../../control-panel/api/keys'),
    logger    = require('../../common').logger.prefix('geo'),
    storage      = require('./../../utils/storage');

var GEO_ENDPOINT = 'https://solid.preyproject.com/geo',
    proxy;

const pattern = /^[0-9a-f]{1,2}([\.:-])(?:[0-9a-f]{1,2}\1){4}[0-9a-f]{1,2}$/;

var save_data = (data) => {
  storage.do('set', {type: 'keys', id: 'last_wifi_location', data: {value: JSON.stringify(data)}}, (err) => {
    if (err) logger.error('Unable to save last_wifi_location data');
  });
}

function wifi(cb) {
  logger.info("Getting location via wifi strategy");

  providers.get('access_points_list', function(err, list) {
    if (err) return cb(err);

    send_data(list, cb);
  });

  function send_data(list, cb) {

    logger.debug("Sending AP data to location service");

    var aps = [];

    if (list && Array.isArray(list) && list.length > 1) {
      list = list.sort((a, b) => {
        return b.signal_strength - a.signal_strength;
      });
    }

    list.slice(0, 30).forEach(function(ap) {
      if(ap.mac_address && pattern.test(ap.mac_address.toLowerCase())==true){
        var current_ap = {
          "macAddress": ap.mac_address,
          "ssid": ap.ssid,
          "signalStrength": ap.signal_strength,
          "channel": ap.channel
        }
        aps.push(current_ap);
      }  
    });

    if (aps && Array.isArray(aps) && aps.length > 1) {
      aps = aps.sort((a, b) => {
        return b.signalStrength - a.signalStrength;
      });
    }

    var data = {
      "wifiAccessPoints": aps
    }
    proxy = config.get('try_proxy');

    var opts = {
      user_agent: common.system.user_agent,
      username: keys.get().device,
      password: keys.get().api,
      json : true
    }
    if (proxy) opts.proxy = proxy;

    needle.post(GEO_ENDPOINT, data, opts, function(err, resp, body) {

      if (err) return cb(err);
      if (resp && resp.statusCode == 429) {
        storage.do('query', {type: 'keys', column: 'id', data: 'last_wifi_location'}, (err, stored_data) => {
          if (err) return cb(new Error('Unable to read geo data'));
          if (stored_data && stored_data.length == 0)  return cb(new Error('There is no geo data in DB'));
          else{
            try {
              stored_data = JSON.parse(stored_data[0].value);
              return cb(null, stored_data);
            } catch (e) {
              return cb(new Error("Couldn't get data in sqlite storage geo"));
            }
          }
        })
      }
      check_response(body, function(err, stdout) {
        if (err) return cb(err);

        // If the response includes the location already it's immediately processed
        if (stdout.geolocation)
          return process_response(stdout.geolocation, cb);

        // TODO: implement retry strategy 
        if (!stdout.endpoint) {
          return cb(new Error("No location endpoint available"));
        }
        
        var url = stdout.endpoint.url,
            provider = stdout.endpoint.provider;

        var options = {
          user_agent: stdout.endpoint['user-agent'],
          json : true
        }
        if (proxy) opts.proxy = proxy;
        
        // Get the location using the url and mac addresses data;
        needle.post(url, data, options, function(err, resp, body) {
          if (err) {
            logger.info("strategies err:" + JSON.stringify(err));
            return cb(err);
          }
          if (body && body.error) {
            logger.info("strategies err:" +JSON.stringify(body));
            return cb(err); 
          }

          check_response(body, function(err, stdout) {
            if (err) return cb(err);

            var geolocation = stdout;
            var loc_data = {
              "geolocation": geolocation,
              "wifiAccessPoints": aps,
              "provider": provider
            }
            var opts = {
              user_agent: common.system.user_agent,
              json : true,
              username: keys.get().device,
              password: keys.get().api,
            }
            if (proxy) opts.proxy = proxy;

            // Send the new location info and process it
            needle.put(GEO_ENDPOINT, loc_data, opts, function(err, resp) {
              logger.debug("Sending location data to prey service")
              if (err) {
                logger.info("error service" + GEO_ENDPOINT + " PUT:" + JSON.stringify(err));
                return cb(err);
              }
              process_response(geolocation, cb);
            });

          });

        });

      });

    });

  }

  function check_response(body, cb) {
    var output;

    if (typeof body === 'object') {
      output = body;
    } else {
      try {
        output = JSON.parse(body);
      } catch (e) {
        return cb(e);
      }
    }
    return cb(null, output);
  }

  function process_response(coords, cb) {
    logger.info("Processing wifi data response");

    if (!coords.location || (!coords.location.lat && !coords.location.latitude))
      return cb(new Error("Couldn't get any geoposition data. Try moving around a bit."));

    var data = {
      lat: coords.location.lat || coords.location.latitude,
      lng: coords.location.lng || coords.location.longitude,
      accuracy: coords.accuracy || coords.location.accuracy,
      method: 'wifi'
    };

    storage.do('query', {type: 'keys', column: 'id', data: 'last_wifi_location'}, (err, stored_data) => {
      if (err) logger.error('Unable to read last_wifi_location data');
      if (stored_data && stored_data.length == 0) save_data(data);
      else{
        storage.do('del', {type: 'keys', id: 'last_wifi_location'}, (err) => {
          if (err) logger.error('Unable to delete last_wifi_location data');
          save_data(data);
        })
      }
    })
    return cb(null, data);
  }
}

function geonative(cb) {
  logger.info("Getting location via native geoloc");

  platform.get_location(function(err, res) {
    if (err) {
      return cb(err);
    }

    logger.debug("Got location via native geoloc");

    // Avoid adding property in each native geoloc implementation
    res.method = 'native';

    return cb(null, res);
  });
}

module.exports = {
  'wifi'  : wifi,
  'native': geonative
};
