"use strict";

var strategies = require('./strategies'),
    hooks      = require('./../../hooks'),
    os_name    = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    logger     = require('../../common').logger.prefix('geo');

var default_strategy = 'wifi',
    strategies_list = ['native', 'wifi', 'geoip'],
    current;

function log_error(err, strategy) {
  logger.debug("Error getting location using " + strategy + " strategy: " + err);
}

exports.set_default = (strategy) => {
  default_strategy = strategy;
}

exports.get_location = function(cb) {
  hooks.trigger('get_location', cb);
}

exports.fetch_location = function(cb) {
  current = default_strategy
  strategies[default_strategy](strategy_callback);

  function strategy_callback(err, res) {
    if (err) {
      log_error(err, current);

      var next = strategies_list.indexOf(current) + 1;

      if (next == strategies_list.length)
        return cb(err);

      current = strategies_list[next];
      return strategies[strategies_list[next]](strategy_callback);
    }

    return cb(null, res);
  }

}
