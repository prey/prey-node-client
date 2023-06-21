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
const rootPath = process.env.rootPath || join(__dirname, '..');

const version = require(join(rootPath, 'package')).version;
const system = require(join(rootPath, 'lib', 'system'));
const configFile = 'prey.conf';
// config paths and object

var defaultConfigFile = join(rootPath, configFile + '.default');
var configPath = program.path ? resolve(program.path) : system.paths.config;
var config = require('getset').load({
  path: join(configPath, configFile),
  type: 'file',
});

// exports
module.exports = {
  package: require(join(rootPath, 'lib', 'package')),
  exceptions: require(join(rootPath, 'lib', 'exceptions')),
  system,
  config,
  defaultConfigFile,
  pidFile: system.tempfile_path('prey.pid'),
  os_name: system.os_name,
  os_release: system.os_release,
  program,
  rootPath,
  version,
};
