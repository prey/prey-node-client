"use strict";

var strategies = require('./strategies'),
    hooks = require('./../../hooks'),
    logger = require('../../common').logger.prefix('geo');

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
      return strategies.google(google_cb);
    }

    return cb(null, res);
  }

  function google_cb(err, res) {
    if (err) {
      log_error(err, "google");
      return strategies.geoip(geoip_cb);
    }

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
