const fs = require('fs');
const { join } = require('path');
const providers = require('./providers');
const common = require('./common');

const { system } = common;
const { config } = common;
const logger = common.logger.prefix('reports');
const gte = common.helpers.is_greater_or_equal;
const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const hooks = require('./hooks');
const { get_picture } = require('./providers/webcam');

const reportsPath = join(__dirname, 'reports');
let available; // need to start as null
const active = {};

const prevAutoConnect = config.get('auto_connect'); // to restore when cancelled
/**
 * Returns an array with unique elements from the given array.
 *
 * @param {Array} arr - The input array.
 * @return {Array} An array with unique elements.
 */
const unique = (arr) => {
  const temp = {};
  const r = [];
  for (let i = 0; i < arr.length; i += 1) temp[arr[i]] = true;

  temp.forEach((k) => {
    r.push(k);
  });
  return r;
};
/**
 * A function that filters out elements from array 'a' that are present in array 'b'.
 *
 * @param {Array} a - The array to filter elements from.
 * @param {Array} b - The array containing elements to be filtered out.
 * @return {Array} - The filtered array.
 */
// eslint-disable-next-line array-callback-return
const rejectFilter = (a, b) => a.filter((el) => {
  if (b.indexOf(el) === -1) return el;
  return null;
});

/**
 * This function maps over the available reports and returns an object with their includes.
 *
 * @param {Function} cb - The callback function that is invoked with the available reports.
 *   It should have the signature `cb(error, result)`.
 * @return {undefined} This function does not return a value directly.
 * The result is passed to the callback function.
 */
// eslint-disable-next-line consistent-return
const map = (cb) => {
  if (available) { return cb(null, available); }

  // eslint-disable-next-line consistent-return
  fs.readdir(reportsPath, (err, files) => {
    if (err) return cb(err);

    available = {};
    files.forEach((reportName) => {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const report = require(`${join(reportsPath, reportName)}`);
      if (report && report.includes) { available[reportName.replace('.js', '')] = report.includes; }
    });

    cb(null, available);
  });
};
/**
 * Gathers data for a specific report.
 *
 * @param {string} reportName - The name of the report to gather data for.
 * @param {Array} list - The list of data providers to use for gathering the report data.
 * @param {function} cb - The callback function to be called when the data gathering is complete.
 * @return {void}
 */
const gather = (reportName, list, cb) => {
  const data = {};
  let gathered = false;
  let count = list.length;
  let listReports = [...list];

  if (reportName !== 'status') { logger.info(`Gathering ${reportName} report.`); }

  // eslint-disable-next-line consistent-return
  const checkTpm = (callback) => {
    const editions = ['Pro', 'Education', 'Enterprise'];
    // Validate encryption compatibilities before get the TPM module (only on windows 10)
    if (reportName === 'specs' && osName === 'windows' && gte(system.os_release, '10.0.0')
      && data.os_edition && editions.includes(data.os_edition)
      && data.winsvc_version && gte(data.winsvc_version, '2.0.0')) {
      providers.get('tpm_module', (err, output) => {
        if (!err) data.tpm_module = output;
        return callback();
      });
    } else return callback();
  };

  const finished = () => {
    if (gathered) return;
    gathered = true;

    if (reportName !== 'status') { logger.info(`Report gathered: ${reportName}`); }

    // eslint-disable-next-line consistent-return
    checkTpm(() => {
      // once finished, callback (if passed) or emit via hooks
      if (cb) return cb(null, data);
      hooks.emit('report', reportName, data);
    });
  };

  const done = (err, result, key) => {
    if (result) data[key] = result;
    if (err && key !== 'extra_attachment') { logger.error(`Unable to get ${key}: ${err.message}`); }

    logger.debug(`[${count - 1}/${list.length}] Got ${key}`);
    count -= 1;
    if (count <= 0) finished();
  };
  if (list.includes('extra_attachment')) {
    listReports = list.filter((el) => el !== 'extra_attachment' && el !== 'picture');
    const webcamPromise = new Promise((resolve) => {
      // eslint-disable-next-line consistent-return
      get_picture((err, filePath) => {
        if (err) return resolve(err);
        resolve(err, filePath);
      });
    });

    webcamPromise.then((err, filePath) => {
      done(err, filePath, 'picture');
      providers.get('extra_attachment', done);
    });
  }
  listReports.forEach((trace) => {
    providers.get(trace, done);
  });
};
/**
* Cancels a report.
*
* @param {string} reportName - The name of the report to cancel.
* @return {undefined} This function does not return anything.
*/
// eslint-disable-next-line consistent-return
const cancel = (reportName) => {
  if (!active[reportName]) { return logger.error(`Report ${reportName} not active!`); }

  logger.warn(`Canceling ${reportName} report.`);
  config.set('auto_connect', prevAutoConnect); // restore original value

  const { timer } = active[reportName];
  clearInterval(timer);
  // this.removeAllListeners(reportName);
  delete (active[reportName]);
};
/**
 * Queue a report to be generated at regular intervals.
 *
 * @param {string} reportName - The name of the report to be generated.
 * @param {Array} list - The list of items to be included in the report.
 * @param {object} opts - Additional options for generating the report.
 * @param {number} opts.interval - The interval at which the report should
 * be generated (in milliseconds).
 * @return {undefined} This function does not return a value.
 */
const queue = (reportName, list, opts) => {
  let interval = opts.interval && parseInt(opts.interval, 10);
  if (!interval) return;

  // interval reporting triggered, so force auto connect to true
  config.set('auto_connect', true);

  // in case the delay is sent in minutes
  if (interval < 1000) interval = interval * 60 * 1000;
  logger.info(`Queuing ${reportName} report every ${interval / (60 * 1000)} minutes.`);

  const timer = setInterval(() => {
    gather(reportName, list);
  }, interval);

  active[reportName] = { timer, options: opts };
};
/**
 * Retrieves a report by its name and options.
 *
 * @param {string} reportName - The name of the report to retrieve.
 * @param {object|function} options - The options for retrieving the report. If a function
 * is provided, it will be used as the callback.
 * @param {function} callback - The callback function to be invoked with the retrieved report.
 * @return {undefined} This function does not return anything.
 */
const get = (reportName, options, callback) => {
  let cb;
  let optionsGet;
  if (typeof options === 'function') {
    cb = options;
    optionsGet = {};
  } else {
    cb = callback;
    optionsGet = options || {};
  }

  // if a report by that name was already queued
  // lets cancel the existing one first
  if (active[reportName] && optionsGet.interval) { cancel(reportName); }

  // eslint-disable-next-line consistent-return
  map((err) => {
    if (err) return cb && cb(err);

    let list = available[reportName] || [];

    if (optionsGet.include) { list = unique(list.concat(optionsGet.include)); }
    if (optionsGet.exclude) {
      if (optionsGet.exclude.includes('picture')) { optionsGet.exclude.push('extra_attachment'); }
      list = rejectFilter(list, optionsGet.exclude);
    }

    if (list.length === 0) {
      const errDataFetch = new Error(`No data to fetch for "${reportName}"`);
      hooks.trigger('error', errDataFetch);
      return cb && cb(errDataFetch);
    }

    // logger.debug('Gathering: ' + list.join(', '))
    gather(reportName, list, cb); // get one immediately

    if (optionsGet.interval) { queue(reportName, list, optionsGet || {}); }
  });
};
/**
 * Cancels all active reports.
 *
 * @param {Array} active - the array of active report names
 * @return {undefined} no return value
 */
const cancelAll = () => {
  active.forEach((reportName) => {
    cancel(reportName);
  });
};
/**
 * Generates a list of active objects with their names and options.
 *
 * @return {Array} The list of active objects.
 */
const running = () => {
  const list = [];
  active.forEach((key) => {
    const obj = { name: key, options: active[key].options };
    list.push(obj);
  });
  return list;
};

exports.map = map;
exports.get = get;
exports.running = running;
exports.cancel = cancel;
exports.cancel_all = cancelAll;
