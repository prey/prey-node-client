/**
 * Common
 *
 * The Main object of the prey client.
 * Contains Values and Objects usable both by
 * the conf module and the agent.
 *
 */

var join                = require('path').join
  , resolve             = require('path').resolve
  , program             = require('commander')
  , root_path           = process.env.ROOT_PATH || join(__dirname, '..')
  , version             = require(join(root_path, 'package')).version
  , system              = require(join(root_path, 'lib', 'system'));

// config paths and object

var config_file         = 'prey.conf'
  , default_config_file = join(root_path, config_file + '.default')
  , config_path         = program.path ? resolve(program.path) : system.paths.config
  , config              = require('getset').load({ path: join(config_path, config_file), type: 'file' });

// exports

module.exports = {
    package             : require(join(root_path, 'lib', 'package'))
  , plugins             : require(join(root_path, 'lib', 'plugins')).init(config)
  , exceptions          : require(join(root_path, 'lib', 'exceptions'))
  , system              : system
  , config              : config
  , config_path         : config_path
  , default_config_file : default_config_file
  , pid_file            : system.tempfile_path('prey.pid')
  , os_name             : system.os_name
  , os_release          : system.os_release
  , program             : program
  , root_path           : root_path
  , version             : version
}
