#!/usr/bin/env node

/**
 * TEST LIBRARY
 *
 * Prey Client
 *
 * Script to test the command `./bin/prey config activate`
 * Should be run as the `prey user`
 *
 */

// Modules and Dependencies to be injected
var assert  = require('assert'),
    path    = require('path'),
    program = require('commander'),
    sandbox = require('sandboxed-module'),
    helpers = require('./lib/conf/helpers')

var callback = function (err, message) {
  if (err) {
    return console.log('END - ERR: ' + err.message);
  }
  return console.log('END - OK');
}

var log = function (msg) {
  return console.log('MSG: ' + msg);
}

// We need to modify this variable
var newPath = __dirname + '/../../test_conf';
program.path = path.resolve(newPath);

var common = sandbox.require('./lib/common', {
  requires    : {
    'commander' : program
  }
});

// This value should be '/etc/prey'
assert.equal( common.system.paths.config, '/etc/prey'
            , '`common.system.paths.config` should be equal to `/etc/prey`');

// If we are OK, let's change the path for a custom one
common.system.paths.config = path.resolve(__dirname, '..', '..', 'test_conf');

// Besides, we need to make something with this function:
helpers.run_detached = function (gui_path, args) {
  console.log('MSG: helpers.run_detached called');
  console.log('MSG: gui_path - ' + gui_path);
  console.log('MSG: args - ' + args);
}

// Create the cli object with dependency injections
var cli_controller_constructor = sandbox.require('./lib/conf/cli_controller', {
  requires              : {
    './../common'       : common,
    './helpers'         : helpers
  }
});

// 'Construct' the cli_controller
var cli_controller = cli_controller_constructor(log, callback);

// Issue the command
//    Do we have the `-g` parameter?
var activateValues = {};
if (process.argv.length > 2 && process.argv[2] === '-g')
  activateValues = { '-g' : true }

cli_controller.activate(activateValues);
