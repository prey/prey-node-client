/* eslint-disable global-require */
/* eslint-disable consistent-return */
const fs = require('fs');
const { join } = require('path');
const logger = require('./common').logger.prefix('providers');
const hooks = require('./hooks');

const providersPath = join(__dirname, 'providers');
let reports;
let gettersList;
const files = [];
const callbacks = {};

const loadProvider = (name) => {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(join(providersPath, name));
  } catch (e) {
    hooks.trigger('error', e);
  }
};

/**
 * Given a provider module, check its keys for a functions that begin with 'get'
 * and return an array of {name, func} pairs, so that the function
 * can be called applied to its module.
 * */

const findGetters = (module) => Object.keys(module)
  .filter((k) => k.startsWith('get') && typeof module[k] === 'function')
  .map((k) => ({ name: k.slice(4), fn: module[k] }));

/**
 * Traverse the providers path and extract all getter function into the getters
 * object. Function name used as index has the get_ stripped.
 * */

exports.map = (cb) => {
  if (gettersList) return cb(null, gettersList);

  fs.readdir(providersPath, (err, filesData) => {
    if (err) return cb(err);

    gettersList = {};
    filesData.forEach((providerName) => {
      const module = loadProvider(providerName);
      if (!module) return;

      findGetters(module).forEach((getter) => {
        gettersList[getter.name] = getter.fn;
      });
    });

    cb(null, gettersList);
  });
};
/**
 * providers.get takes care of calling a specified provider and either
 * calling the callback with the result or firing an error or data event
 * depending on the result.
 *
 * Examples:
 * get('users', callback)
 * get('tree', {user: 'someuser'})
 * get('tree', {user: 'someuser'}, callback)
 */
function get(nameGet, extra, extra2, timesLimit = 0) {
  let name = nameGet;
  let cb;
  // eslint-disable-next-line prefer-rest-params
  const args = arguments;
  let options;

  if (typeof (extra) === 'function') cb = extra;
  else {
    options = extra;
    // in case there's a third argument and it's a cb
    if (args[2] && typeof (args[2]) === 'function') [, cb] = args;
  }

  const fireCallbacks = (nameCalled, err, result) => {
    const list = callbacks[nameCalled];
    callbacks[nameCalled] = [];

    list.forEach((fn) => {
      fn(err, result, nameCalled, timesLimit + 1);
    });
  };

  if (name === 'report') name = 'stolen';

  // eslint-disable-next-line array-callback-return
  exports.map((err, getters) => {
    if (err && cb) return cb(err, null, null, timesLimit + 1);

    if (getters[name]) {
      callbacks[name] = callbacks[name] || [];
      if (cb) callbacks[name].push(cb);

      if (callbacks[name].length > 1) {
        return logger.info(`${name} already in progress.`);
      }

      logger.debug(`Fetching ${name}`);

      const getterCb = (errCb, result) => {
        fireCallbacks(name, errCb, result);

        if (!cb) { // only emit when no callback passed
          if (errCb) hooks.trigger('error', errCb);
          else hooks.trigger('data', name, result);
        }

        if (result && result.file && result.content_type) {
          files.push(result.file); // keep a record so we remove it afterwards
        }
      };

      if (options) {
        getters[name](options, getterCb);
      } else {
        getters[name](getterCb);
      }
    } else {
      if (!reports) reports = require('./reports');
      reports.get(name, args[1], args[2], timesLimit); // pass original arguments
    }
  });
}

exports.remove_files = (cb) => {
  let lastError;
  let count = files.length;

  const done = (err) => {
    if (err) lastError = err;
    count -= 1;
    if (count <= 0) {
      if (typeof cb === 'function') return cb(lastError);
    }
  };

  files.forEach((entry) => {
    if (entry.file && entry.content_type) fs.unlink(entry.file, done);
  });
};

exports.get = get;
