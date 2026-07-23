/* eslint-disable global-require */
/* eslint-disable consistent-return */
/* eslint-disable no-underscore-dangle */
const client = require('needle');

const fetEnvVAr = require('./utils/fetch-env-var');

const host = fetEnvVAr('debug') ? 'https://exceptions.preyhq.com' : 'https://exceptions.preyproject.com';
const QUOTA_KEY = 'exception_quota';

const getTodayDate = () => new Date().toISOString().slice(0, 10);
const freshQuota = () => ({ date: getTodayDate(), total: 0, errors: {} });

// In-memory quota — updated synchronously on every send so rapid calls
// see the correct counters without waiting for the DB write to complete.
// Persisted to DB as a fire-and-forget so it survives agent restarts.
let _quota = null;
let _quotaExistsInDb = false;

const persistQuota = (quota) => {
  const { saveDataDbKey, updateDataDbKey } = require('./agent/utils/storage/utilstorage');
  const serialized = JSON.stringify(quota);
  if (_quotaExistsInDb) {
    updateDataDbKey('keys', QUOTA_KEY, 'value', serialized, () => {});
  } else {
    saveDataDbKey('keys', QUOTA_KEY, serialized, () => {});
    _quotaExistsInDb = true;
  }
};

const ensureQuota = (cb) => {
  const today = getTodayDate();
  if (_quota && _quota.date === today) return cb(null, _quota);

  const { getDataDbKey } = require('./agent/utils/storage/utilstorage');
  getDataDbKey(QUOTA_KEY, (err, stored) => {
    // A concurrent ensureQuota call may have already populated _quota while
    // this DB read was in-flight; reuse it instead of overwriting.
    if (_quota && _quota.date === today) return cb(null, _quota);

    if (err || !stored) {
      _quota = freshQuota();
      _quotaExistsInDb = false;
      return cb(null, _quota);
    }
    try {
      const loaded = JSON.parse(stored[0].value);
      if (loaded && loaded.date === today) {
        // Sanitize numeric fields to prevent type corruption from mangled JSON
        loaded.total = Math.max(0, parseInt(loaded.total, 10) || 0);
        if (loaded.errors && typeof loaded.errors === 'object') {
          Object.keys(loaded.errors).forEach((k) => {
            loaded.errors[k] = Math.max(0, parseInt(loaded.errors[k], 10) || 0);
          });
        } else {
          loaded.errors = {};
        }
        _quota = loaded;
      } else {
        _quota = freshQuota();
      }
    } catch (_parseErr) {
      _quota = freshQuota();
    }
    _quotaExistsInDb = true;
    return cb(null, _quota);
  });
};

exports.send = (err, cb) => {
  const { release } = require('os');
  const { version } = require('./common');
  const keys = require('./agent/control-panel/api/keys');
  const config = require('./utils/configfile');

  // prevent exceptions from being sent when running tests
  if (process.env.TESTING) return cb && cb();
  if (!(err instanceof Error)) return cb && cb(new Error('Not an error.'));

  const dailyLimit = parseInt(config.getData('exceptions_daily_limit'), 10) || 50;
  const perErrorLimit = parseInt(config.getData('exceptions_per_error_limit'), 10) || 3;

  ensureQuota((loadErr, quota) => {
    const errorKey = (err.message || 'unknown').slice(0, 120);
    const errorCount = quota.errors[errorKey] || 0;

    if (quota.total >= dailyLimit || errorCount >= perErrorLimit) {
      return cb && cb();
    }

    // Update in-memory synchronously before any async work, so concurrent
    // calls in the same tick see the updated counters immediately.
    _quota = {
      date: quota.date,
      total: quota.total + 1,
      errors: { ...quota.errors, [errorKey]: errorCount + 1 },
    };
    persistQuota(_quota);

    const data = {
      message: err.message,
      backtrace: err.stack,
      deviceKey: keys.get().device,
      cwd: process.cwd(),
      language: 'node',
      version: process.version,
      framework: `Prey/${version}`,
      platform: process.platform,
      release: release(),
      user: process.env.USER || process.env.LOGNAME,
      args: process.argv,
      env: process.env,
      gid: process.getgid && process.getgid(),
      uid: process.getuid && process.getuid(),
      pid: process.pid,
      memory: process.memoryUsage(),
      extra: err.extra || null,
    };

    client.post(
      host,
      data,
      {
        content_type: 'application/json',
        timeout: 4500,
      },
      (errPost) => cb && cb(errPost),
    );
  });
};
