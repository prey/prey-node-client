var fs      = require('fs'),
    join    = require('path').join,
    spawn   = require('child_process').spawn,
    should  = require('should'),
    sandbox = require('./../../utils/spawner_sandbox'),
    helpers = require('./../../helpers');

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

  describe('activate', function(){

  })

  describe('upgrade', function() {

    describe('with no arguments', function() {

      describe('with no versions support', function() {

        before(function(done) {
          var deps = {
            './../common' : common_base,
          }

          sandbox.put(conf_cli_file, deps, done);
        })

        after(unsandboxize_cli)

        it('fails miserably', function(done) {

          run_cli(['config', 'upgrade'], function(code, out, err) {
            should.not.exist(out);
            code.should.equal(0); // TODO: this should be 1
            done();
          })

        })

      })

      describe('with versions support', function() {

        before(function(done) {
          var common = common_base;
          common.system.paths = { versions: '/tmp/versions' };

          var deps = {
            './../common' : common,
            './versions'  : { latest: function() { return '0.9.2' } },
            './../package': { get_latest: function(latest, dest, cb) { return cb(new Error('Called!')) } }
          }

          sandbox.put(conf_cli_file, deps, done);
        })

        after(unsandboxize_cli)

        it('tries to fetch latest version', function(done) {

          run_cli(['config', 'upgrade'], function(code, out, err) {
            out.should.include('Error! Called!');
            code.should.equal(1);
            done();
          })

        })

      })

    })

    describe('with a -v argument', function() {

    })

  })

  describe('settings', function(){

  })

  describe('account', function() {

    describe('verify', function() {

      before(function(done) {
        var deps = {
          './../common' : common_base,
          './panel' : { verify_keys: function(keys, cb) { return cb(new Error('Called!')) } }
        }

        sandbox.put(conf_cli_file, deps, done);
      })

      after(unsandboxize_cli)

      it('tries to verify keys', function(done){

        run_cli(['config', 'account', 'verify', '-a', 'foobar', '-d', 'barbaz'], function(code, out, err) {
          out.should.include('Error! Called!');
          done();
        })

      })

      describe('with invalid api key and email', function() {

        it('returns error code 1', function(done){

          run_cli(['config', 'account', 'verify', '-a', 'invalid', '-d', 'blablabla'], function(code, out, err) {
            code.should.equal(1);
            done();
          })

        })

      });

    })

  })

  describe('hooks', function(){

    describe('post_install', function(){

    })

    describe('pre_uninstall', function(){

    })

  })

  describe('check', function(){

  })

  describe('run', function(){

  })

  describe('gui', function(){

  })

})
