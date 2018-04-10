"use strict";

var strategies = require('./strategies'),
    hooks = require('./../../hooks'),
    logger = require('../../common').logger.prefix('geo');

var attempt = 0,
    MAX_ATTEMPS = 3;

function log_error(err, strategy) {
  logger.debug("Error getting location using " + strategy + " strategy: " + err);
}

exports.get_location = function(cb) {
  hooks.trigger('get_location', cb);
}

exports.fetch_location = function(cb) {
  strategies.native(native_cb);

  function native_cb(err, res) {
    if (err) {
      log_error(err, "native");
      return strategies.wifi(wifi_cb);
    }

    return cb(null, res);
  }

  function wifi_cb(err, res) {
    attempt++;
    logger.debug("Location via wifi strategy, attempt: " + attempt);
    if (err) {
      log_error(err, "wifi");
      if (attempt < MAX_ATTEMPS)
        return strategies.wifi(wifi_cb);
      attempt = 0;
      return strategies.geoip(geoip_cb);
    }

    attempt = 0;
    return cb(null, res);
  }

  function geoip_cb(err, res) {
    if (err) {
      log_error(err, "geoip");
      return cb(err);
    }

    return cb(null, res);
  }

}
