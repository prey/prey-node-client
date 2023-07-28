const client = require('needle');
const getSet = require('getset');
const program = require('commander');
const { join, resolve } = require('path');
const { release } = require('os');
const { version } = require('../package.json');

const rootPath = process.env.rootPath || join(__dirname, '..');
// eslint-disable-next-line import/no-dynamic-require
const system = require(join(rootPath, 'lib', 'system'));
const { load } = getSet;
const configFile = 'prey.conf';
const configPath = program.path ? resolve(program.path) : system.paths.config;
const config = load({ path: join(configPath, configFile), type: 'file' });

const host = 'https://exceptions.preyproject.com';

// eslint-disable-next-line consistent-return
exports.send = (err, cb) => {
  // prevent exceptions from being sent when running tests
  if (process.env.TESTING) return cb && cb();

  if (!(err instanceof Error)) return cb && cb(new Error('Not an error.')); // paradox.

  const exceptionData = {
    message: err.message,
    backtrace: err.stack, // .split('\n'),
    deviceKey: config.get('control-panel.device_key').toString(),
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
    exceptionData,
    {
      content_type: 'application/json',
      timeout: 4500,
    },
    (errCb) => cb && cb(errCb),
  );
};
