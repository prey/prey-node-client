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
  , root_path           = process.env.ROOT_PATH || join(__dirname, '..')
  , version             = require(join(root_path, 'package')).version
  , program             = require('commander')
  , system              = require(join(root_path, 'lib', 'system'))
  , setup               = require(join(root_path, 'lib', 'setup'))
  , api                 = require(join(root_path, 'lib', 'api'))
  , package             = require(join(root_path, 'lib', 'package'));

// config paths and object

var pid_file            = system.tempfile_path('prey.pid')
  , config_file         = 'prey.conf'
  , default_config_file = join(root_path, config_file + '.default')
  , config_path         = program.path ? resolve(program.path) : system.paths.config
  , config              = require('getset').load(join(config_path, config_file));

// having config, set up api settings

api.use({
  protocol              : config.get('protocol'),
  host                  : config.get('host')
})

// exports

module.exports = {
    api                 : api
  , setup               : setup
  , package             : package
  , config              : config
  , config_path         : config_path
  , default_config_file : default_config_file
  , pid_file            : pid_file
  , os_name             : system.os_name
  , program             : program
  , root_path           : root_path
  , system              : system
  , version             : version
}
