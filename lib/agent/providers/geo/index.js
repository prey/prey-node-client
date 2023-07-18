const strategies = require('./strategies');
const hooks = require('../../hooks');
const logger = require('../../common').logger.prefix('geo');

const strategiesList = ['native', 'wifi', 'geoip'];

let defaultStrategy = 'wifi';
let current;

const logError = (err, strategy) => {
  logger.debug(`Error getting location using ${strategy} strategy: ${err}`);
};

exports.set_default = (strategy) => {
  defaultStrategy = strategy;
};

exports.get_location = (cb) => {
  hooks.trigger('get_location', cb);
};

exports.fetch_location = (cb) => {
  current = defaultStrategy;
  const strategyCallback = (err, res) => {
    if (err) {
      logError(err, current);
      const next = strategiesList.indexOf(current) + 1;
      if (next === strategiesList.length) return cb(err);
      current = strategiesList[next];
      return strategies[strategiesList[next]](strategyCallback);
    }
    return cb(null, res);
  };
  strategies[defaultStrategy](strategyCallback);
};
