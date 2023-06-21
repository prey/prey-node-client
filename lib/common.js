/* eslint-disable import/no-dynamic-require */
/**
 * Common
 *
 * The Main object of the prey client.
 * Contains Values and Objects usable both by
 * the conf module and the agent.
 *
 */

const path = require('path');
const program = require('commander');

const { join, resolve } = path;
const configFile = 'prey.conf';
const rootPath = process.env.rootPath || join(__dirname, '..');
const defaultConfigFile = join(rootPath, `${configFile}.default`);

const rootPackage = require(join(rootPath, 'package'));
const { version } = rootPackage;

const system = require(join(rootPath, 'lib', 'system'));
const { osName, osRelease } = system;
const pidFile = system.tempfile_path('prey.pid');

const configPath = program.path ? resolve(program.path) : system.paths.config;
const config = require('getset').load({
  path: join(configPath, configFile),
  type: 'file',
});

const exceptions = require(join(rootPath, 'lib', 'exceptions'));

// exports
module.exports = {
  package: require(join(rootPath, 'lib', 'package')),
  exceptions,
  system,
  config,
  defaultConfigFile,
  pidFile,
  osName,
  osRelease,
  program,
  rootPath,
  version,
};
