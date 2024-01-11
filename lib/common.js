const { join } = require('path');
const { resolve } = require('path');
const program = require('commander');

const root_path = process.env.ROOT_PATH || join(__dirname, '..');

// eslint-disable-next-line import/no-dynamic-require
const system = require(join(root_path, 'lib', 'system'));
// eslint-disable-next-line import/no-dynamic-require
const { version } = require(join(root_path, 'package'));

const config_file = 'prey.conf';
const default_config_file = join(root_path, `${config_file}.default`);
const config_path = program.path ? resolve(program.path) : system.paths.config;

module.exports = {
  package: require(join(root_path, 'lib', 'package')),
  exceptions: require(join(root_path, 'lib', 'exceptions')),
  system,
  config_path,
  default_config_file,
  pid_file: system.tempfile_path('prey.pid'),
  os_name: system.os_name,
  os_release: system.os_release,
  program,
  root_path,
  version,
};
