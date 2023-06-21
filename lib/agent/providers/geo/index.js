const strategies = require('./strategies');
const hooks = require('../../hooks');
const logger = require('../../common').logger.prefix('geo');

const strategiesList = ['native', 'wifi'];
let defaultStrategy = 'wifi';
let current;
let next;

exports.set_default = (strategy) => {
  defaultStrategy = strategy;
};

exports.get_location = (cb) => {
  hooks.trigger('get_location', cb);
};

exports.fetch_location = (cb) => {
  function strategyCallback(err, res) {
    if (err) {
      logger.debug(`Error getting location using ${current} strategy: ${err}`);

      next = strategiesList.indexOf(current) + 1;

      if (next === strategiesList.length) {
        return cb(err);
      }

      current = strategiesList[next];
      return strategies[strategiesList[next]](strategyCallback);
    }

    return cb(null, res);
  }

  current = defaultStrategy;
  strategies[defaultStrategy](strategyCallback);
};
