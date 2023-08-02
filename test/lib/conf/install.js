var join        = require('path').join,
    spawn       = require('child_process').spawn,
    should      = require('should'),
    sandbox     = require('./../../utils/spawner_sandbox'),
    system = require('../system'),
    helpers     = require('./../../helpers');

var conf_path   = helpers.lib_path('conf'),
    cli_file    = join(conf_path, 'cli.js'),
    script_file = join(conf_path, 'install.js');

/////////////////////////////////////////////////////////
// set up the fake common obj

var mirror   = function(obj) { return obj };

var common_base = {
  osName: 'linux',
  system: {
    tempfile_path: mirror,
    paths: {}
  },
  program: {
    logfile: '/tmp/something.log'
  }
}

/////////////////////////////////////////////////////////
// let the games begin

describe('check', function() {

  it('pending')

})

describe('install/local', function() {

  it('pending')

})

describe('upgrade/remote', function() {

  var cli_sb,
      script_sb;

  function create_sandbox(versions_path, done) {

    var common = common_base;
    system.paths = { 
      versions: versions_path 
    }

    var cli_deps = {
      './../common' : common
    }

    common.package = {
      get_version: function(requested, dest, cb) {
        cb(new Error('get_version called with version ' + requested)) 
      },
      get_latest: function(branch, latest, dest, cb) { 
        cb(new Error('get_latest called with version ' + latest)) 
      }
    }

    var deps = {
      './../common' : common
    };

    deps['./shared'] = { version_manager: { latest: function() { return '0.9.2' } } }

    cli_sb = sandbox.put(cli_file, cli_deps, function() {
      script_sb = sandbox.put(script_file, deps, done);
    });
  }

  function revert_sandbox(done) {
    cli_sb.release(function(err) {
      script_sb.release(done);
    });
  }

  describe('with no versions support', function() {

    before(function(done) {
      create_sandbox(null, done);
    })

    after(revert_sandbox);

    describe('with no arguments', function() {

      it('fails miserably', function(done) {

        helpers.run_cli(['config', 'upgrade'], function(code, out, err) {
          out.should.containEql('config [command]');
          code.should.equal(2);
          done();
        })

      })

    })

    describe('with a specific version as argument', function() {

      it('fails miserably', function(done) {

        helpers.run_cli(['config', 'upgrade', '1.2.3'], function(code, out, err) {
          out.should.containEql('config [command]');
          code.should.equal(2);
          done();
        })

      })

    })

  })

    describe('with versions support', function() {

    before(function(done) {
      create_sandbox('/tmp/versions', done);
    })

    after(revert_sandbox);

    describe('with no arguments', function() {

      it('tries to fetch latest version', function(done) {

        helpers.run_cli(['config', 'upgrade'], function(code, out, err) {
          out.should.containEql('Error! get_latest called with version 0.9.2');
          // code.should.equal(1);
          done();
        })

      })

    })

    describe('with a specific version as argument', function() {

     it('tries to fetch requested version', function(done) {

        helpers.run_cli(['config', 'upgrade', '1.2.3'], function(code, out, err) {
          out.should.containEql('Error! get_version called with version 1.2.3');
          // code.should.equal(1);
          done();
        })

      });

    })

  })

})
