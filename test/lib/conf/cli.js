var fs      = require('fs'),
    join    = require('path').join,
    spawn   = require('child_process').spawn,
    should  = require('should'),
    inspect = require('util').inspect,
    sandbox = require('./../../utils/spawner_sandbox'),
    helpers = require('./../../helpers');

var conf_path = helpers.lib_path('conf');

var prey_bin = join(__dirname, '..', '..', '..', 'bin', 'prey');

if (process.platform == 'win32')
  prey_bin = prey_bin + '.cmd';

// utility mirror function that returns whatever you pass to it
var mirror   = function(obj) { return obj };

var common_base = {
  os_name: 'linux',
  system: {
    tempfile_path: mirror,
    paths: {}
  },
  program: {
    logfile: '/tmp/something.log'
  }
}

describe('config cli', function() {

  var called = false;
  var conf_cli_file = './lib/conf/cli.js';

  var run_cli = function(args, cb) {
    var out, err, child = spawn(prey_bin, args);
    child.stdout.on('data', function(data) { out += data });
    child.stderr.on('data', function(data) { err += data });
    child.on('exit', function(code) { cb(code, out, err) });
  };

  var unsandboxize_cli = function(done) {
    sandbox.release(conf_cli_file, done);
  }

  describe('when no arguments are passed', function(){

    it('shows help and exits')

    it('returns status code 1')

  })

  describe('tasks', function(){

  })

  describe('check', function(){

  })

  describe('gui', function(){

  })

})
