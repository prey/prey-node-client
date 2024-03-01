/* eslint-disable global-require */
/* eslint-disable consistent-return */
const client = require('needle');

const fetEnvVAr = require('./utils/fetch-env-var');

const host = fetEnvVAr('debug') ? 'https://exceptions.preyhq.com' : 'https://exceptions.preyproject.com';

exports.send = (err, cb) => {
  const { release } = require('os');
  const { version } = require('./common');
  const keys = require('./agent/control-panel/api/keys');
  // prevent exceptions from being sent when running tests
  if (process.env.TESTING) return cb && cb();
  if (!(err instanceof Error)) return cb && cb(new Error('Not an error.'));

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
};
