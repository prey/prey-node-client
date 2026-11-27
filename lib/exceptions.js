// @ts-check
/* eslint-disable global-require */
/* eslint-disable consistent-return */
/* eslint-disable no-underscore-dangle */
const client = require('needle');

const fetEnvVAr = require('./utils/fetch-env-var');

const host = fetEnvVAr('debug') ? 'https://exceptions.preyhq.com' : 'https://exceptions.preyproject.com';
const QUOTA_KEY = 'exception_quota';
const MAX_COMMAND_WORDS = 4;
// The device key lookup in commands.db is optional: past this, report without it.
const DEVICE_KEY_LOOKUP_MS = 3000;
// Callers (uncaughtException handlers) exit or shut down in send's callback, so it
// must always fire, even when the storage queue or the POST never answers.
const SEND_DEADLINE_MS = 10000;

// lib/conf/cli.js splices process.argv on startup, which drops the subcommand
// from reports. This module loads before that (through common.js), so keep a copy.
const originalArgv = process.argv.slice();

/**
 * Args to report: the executable, the script and the leading command words
 * (e.g. `config settings read control-panel.device_key`). Stops at the first
 * flag, since flags may carry credentials (-p password, -a api key, -e email).
 * @param {string[]} argv
 * @returns {string[]}
 */
const reportedArgs = (argv) => {
  const [exe, script, ...rest] = argv;
  const words = [];
  for (let i = 0; i < rest.length && words.length < MAX_COMMAND_WORDS; i += 1) {
    if (String(rest[i]).startsWith('-')) break;
    words.push(rest[i]);
  }
  return [exe, script, ...words].filter((a) => a !== undefined);
};

exports.reportedArgs = reportedArgs;

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
    // Assume the row exists from now on. saveDataDbKey only calls back on error, and
    // then the next persist must INSERT again (an UPDATE would match no row).
    _quotaExistsInDb = true;
    saveDataDbKey('keys', QUOTA_KEY, serialized, (err) => {
      if (err) _quotaExistsInDb = false;
    });
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

/**
 * Finds the device key to tag a report with. The in-memory keys are only set by the
 * agent's control panel, so processes like the conf CLI fall back to the loaded
 * config and then to the `preyconf` row in commands.db (the CLI can fail before
 * its config finishes loading). Never fails: yields null when no key is found or the
 * lookup takes longer than DEVICE_KEY_LOOKUP_MS.
 *
 * @param {{get: () => {device?: string}}} keys
 * @param {{getData: (key: string) => any}} config
 * @param {(deviceKey: string|null) => void} cb
 * @returns {void}
 */
const resolveDeviceKey = (keys, config, cb) => {
  const fromMemory = (keys.get() || {}).device || config.getData('control-panel.device_key');
  if (fromMemory) return cb(fromMemory);

  let settled = false;
  /** @type {any} */
  let timer = null;
  /** @param {string|null} deviceKey */
  const finish = (deviceKey) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    cb(deviceKey);
  };
  timer = setTimeout(() => finish(null), DEVICE_KEY_LOOKUP_MS);

  try {
    const { getDataDbKey } = require('./agent/utils/storage/utilstorage');
    getDataDbKey('preyconf', (dbErr, stored) => {
      let deviceKey = null;
      if (!dbErr && stored && stored[0]) {
        try {
          const preyconf = JSON.parse(stored[0].value);
          deviceKey = (preyconf && preyconf['control-panel.device_key']) || null;
        } catch (_parseErr) {
          deviceKey = null;
        }
      }
      finish(deviceKey);
    });
  } catch (_e) {
    finish(null);
  }
};

/**
 * Reports err to the exceptions server. cb, when given, is always called once, at
 * the latest after SEND_DEADLINE_MS.
 * @param {Error} err
 * @param {Function} [cb]
 */
exports.send = (err, cb) => {
  const { release } = require('os');
  const { version } = require('./common');
  const keys = require('./agent/control-panel/api/keys');
  const config = require('./utils/configfile');

  // prevent exceptions from being sent when running tests
  if (process.env.TESTING) return typeof cb === 'function' && cb();
  if (!(err instanceof Error)) return typeof cb === 'function' && cb(new Error('Not an error.'));
  // err.level signals a known/expected error -- skip sending to avoid noise
  // @ts-ignore - level is a Prey-specific opt-out property set by callers
  if (err.level != null) return typeof cb === 'function' && cb();

  const dailyLimit = parseInt(config.getData('exceptions_daily_limit'), 10) || 50;
  const perErrorLimit = parseInt(config.getData('exceptions_per_error_limit'), 10) || 3;

  let called = false;
  /** @type {any} */
  let deadline = null;
  /** @param {Error|null} [result] */
  const done = (result) => {
    if (called) return;
    called = true;
    clearTimeout(deadline);
    if (typeof cb === 'function') cb(result);
  };
  if (typeof cb === 'function') {
    deadline = setTimeout(() => done(new Error('Exception report timed out')), SEND_DEADLINE_MS);
  }

  ensureQuota((loadErr, quota) => {
    const errorKey = (err.message || 'unknown').slice(0, 120);
    const errorCount = quota.errors[errorKey] || 0;

    if (quota.total >= dailyLimit || errorCount >= perErrorLimit) {
      return done();
    }

    // Update in-memory synchronously before any async work, so concurrent
    // calls in the same tick see the updated counters immediately.
    _quota = {
      date: quota.date,
      total: quota.total + 1,
      errors: { ...quota.errors, [errorKey]: errorCount + 1 },
    };
    persistQuota(_quota);

    resolveDeviceKey(keys, config, (deviceKey) => {
      const data = {
        message: err.message,
        backtrace: err.stack,
        deviceKey,
        cwd: process.cwd(),
        language: 'node',
        version: process.version,
        framework: `Prey/${version}`,
        platform: process.platform,
        release: release(),
        user: process.env.USER || process.env.LOGNAME,
        args: reportedArgs(originalArgv),
        env: process.env,
        gid: process.getgid && process.getgid(),
        uid: process.getuid && process.getuid(),
        pid: process.pid,
        memory: process.memoryUsage(),
        // @ts-ignore - extra is a Prey-specific supplemental field set by callers
        extra: err.extra || null,
      };

      client.post(
        host,
        data,
        {
          content_type: 'application/json',
          timeout: 4500,
        },
        (errPost) => done(errPost),
      );
    });
  });
};
