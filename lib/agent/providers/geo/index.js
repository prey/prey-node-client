const strategies = require('./strategies');
const hooks = require('../../hooks');
const logger = require('../../common').logger.prefix('geo');
const permissionFile = require('../../../utils/permissionfile');
const socket = require('../../socket');

const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
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

const strategyCallback = (err, res, cb) => {
  if (err) {
    logError(err, current);
    const next = strategiesList.indexOf(current) + 1;
    if (next === strategiesList.length) return cb(err);
    current = strategiesList[next];
    return strategies[strategiesList[next]]((errInside, resInside) => {
      strategyCallback(errInside, resInside, cb);
    });
  }
  return cb(null, res);
};

// eslint-disable-next-line consistent-return
exports.fetch_location = (cb) => {
  if (osName === 'mac') {
    // eslint-disable-next-line consistent-return
    // socket.writeMessage('check-location-perms', () => {
    const permissionNative = permissionFile.getData('nativeLocation');
    const permissionWifi = permissionFile.getData('wifiLocation');
    if ((!permissionNative || permissionNative.localeCompare('true') !== 0)
    && (!permissionWifi || permissionWifi.localeCompare('true') !== 0)) {
      defaultStrategy = 'geoip';
    }
    if (permissionNative.localeCompare('true') === 0) {
      defaultStrategy = 'native';
    } else if (permissionWifi.localeCompare('true') === 0) {
      defaultStrategy = 'wifi';
    }
    strategies[defaultStrategy]((err, res) => strategyCallback(err, res, cb));
    // });
    // eslint-disable-next-line consistent-return
  } else {
    current = defaultStrategy;
    strategies[defaultStrategy]((err, res) => strategyCallback(err, res, cb));
  }
};
