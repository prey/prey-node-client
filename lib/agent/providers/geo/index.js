// @ts-check
const strategies = require('./strategies');
const hooks = require('../../hooks');
const logger = require('../../common').logger.prefix('geo');
const permissionFile = require('../../../utils/permissionfile');
const socket = require('../../socket');
const { nameArray } = require('../../socket/messages');
const { getLocationPermission } = require('../../permissions');

const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const strategiesList = ['native', 'wifi', 'geoip'];
const GEO_FETCH_TIMEOUT_MS = 30 * 1000;

let defaultStrategy = 'wifi';
let current;

const logError = (err, strategy) => {
  logger.debug(`Error getting location using ${strategy} strategy: ${err}`);
};

exports.set_default = (strategy) => {
  defaultStrategy = strategy;
};

exports.get_location = (cb) => {
  // @ts-ignore — hooks has a custom trigger() not in EventEmitter types
  hooks.trigger('get_location', cb);
};
exports.getLocationRequest = (cb) => {
  // @ts-ignore — hooks has a custom trigger() not in EventEmitter types
  hooks.trigger('get_location_request', cb);
};
exports.get_location_native = (cb) => {
  strategies.native((err) => {
    if (err) err.level = 'not fatal';
    cb(err);
  });
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
  let settled = false;
  const timer = setTimeout(() => {
    if (!settled) {
      settled = true;
      logger.error('[geo] fetch_location timed out after 30s');
      cb(new Error('Location fetch timeout'));
    }
  }, GEO_FETCH_TIMEOUT_MS);

  const wrapped = (err, res) => {
    if (!settled) {
      settled = true;
      clearTimeout(timer);
      cb(err, res);
    }
  };

  if (osName === 'mac') {
    // @ts-ignore — socket.writeMessage typings expect a third arg not needed here
    socket.writeMessage(nameArray[1], () => {
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
      strategies[defaultStrategy]((err, res) => strategyCallback(err, res, wrapped));
    });
  } else {
    if (osName === 'windows') {
      logger.debug('[WIN32-INDEX] Windows detected. Delegating to win32LocationFetch orchestrator.');
      setTimeout(() => { getLocationPermission(); }, 8000);
      return strategies.win32LocationFetch(wrapped);
    }
    current = defaultStrategy;
    strategies[defaultStrategy]((err, res) => strategyCallback(err, res, wrapped));
  }
};
