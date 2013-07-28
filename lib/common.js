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
  , needle              = require('needle')
  , system              = require(join(root_path, 'lib', 'system'));

// config paths and object
var config_file         = 'prey.conf'
  , default_config_file = join(root_path, config_file + '.default')
  , config_path         = program.path ? resolve(program.path) : system.paths.config
  , config              = require('getset').load(join(config_path, config_file));

needle.defaults({
  user_agent : 'Prey/' + version + ' (' + system.os_name + ', Node.js ' + process.version + ')',
  timeout    : 20000
})

var common = {
    config              : config
  , config_path         : config_path
  , default_config_file : default_config_file
  , os_name             : system.os_name
  , program             : program
  , root_path           : root_path
  , system              : system
  , version             : version
}

module.exports = common;