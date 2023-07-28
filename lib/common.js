/* eslint-disable import/no-dynamic-require */
const path = require('path');
const program = require('commander');
const getSet = require('getset');
const petit = require('petit');
const helpers = require('./agent/helpers');

const { load } = getSet;
const { join, resolve } = path;
const configFile = 'prey.conf';
const rootPath = process.env.rootPath || join(__dirname, '..');
const defaultConfigFile = join(rootPath, `${configFile}.default`);

const { version } = require('../package.json');

const system = require(join(rootPath, 'lib', 'system'));
const { paths } = system;
const logLevel = process.env.DEBUG ? 'debug' : 'info';
const logFile = program.logfile || helpers.running_on_background()
  ? program.logfile || paths.logFile : null;

const logger = petit.new({
  level: logLevel,
  file: logFile,
  rotate: true,
  size: 2000000,
  limit: 9,
  compress: true,
  dest: paths.config,
});

const { osName, osRelease } = system;
const pidFile = system.tempfile_path('prey.pid');

const configPath = program.path ? resolve(program.path) : system.paths.config;
const config = load({ path: join(configPath, configFile), type: 'file' });

const exceptions = require(join(rootPath, 'lib', 'exceptions'));
const packageController = require(join(rootPath, 'lib', 'package-controller'));

module.exports = {
  packageController,
  exceptions,
  system,
  config,
  defaultConfigFile,
  pidFile,
  osName,
  osRelease,
  program,
  rootPath,
  helpers,
  version,
  logger,
};
