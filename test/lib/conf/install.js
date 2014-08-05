var join    = require('path').join,
    spawn   = require('child_process').spawn,
    should  = require('should'),
    sandbox = require('./../../utils/spawner_sandbox'),
    helpers = require('./../../helpers');

var conf_path = helpers.lib_path('conf'),
    prey_bin = join(__dirname, '..', '..', '..', 'bin', 'prey');

if (process.platform == 'win32')
  prey_bin = prey_bin + '.cmd';

/////////////////////////////////////////////////////////
// set up the fake common obj

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

/////////////////////////////////////////////////////////
// let the games begin

describe('check', function() {

  it('pending')

})

describe('install/local', function() {

  it('pending')

})

describe('upgrade/remote', function() {

  var sb,
      sb_file = join(conf_path, 'install.js');

  var run_cli = function(args, cb) {
    var out, err, child = spawn(prey_bin, args);
    child.stdout.on('data', function(data) { out += data });
    child.stderr.on('data', function(data) { err += data });
    child.on('exit', function(code) { cb(code, out, err) });
  };

  function create_sandbox(versions_path, done) {

    var common = common_base;
    common.system.paths = { 
      versions: versions_path 
    }
    common.package = {
      get_version: function(requested, dest, cb) {
        cb(new Error('get_version called with version ' + requested)) 
      },
      get_latest: function(latest, dest, cb) { 
        cb(new Error('get_latest called with version ' + latest)) 
      }
    }

    var deps = {
      './../common' : common,
      './shared': {
        version_manager: { latest: function() { return '0.9.2' } }
      }
    }

    sb = sandbox.put(sb_file, deps, done);
  }

  function revert_sandbox(done) {
    sb.release(done);
  }

  describe('with no versions support', function() {

    before(function(done) {
      create_sandbox(null, done);
    })

    after(revert_sandbox);

    describe('with no arguments', function() {

      it('fails miserably', function(done) {

        run_cli(['config', 'upgrade'], function(code, out, err) {
          code.should.equal(1);
          done();
        })

      })

    })

    describe('with a specific version as argument', function() {

      it('fails miserably', function(done) {

        run_cli(['config', 'upgrade'], function(code, out, err) {
          code.should.equal(1);
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

        run_cli(['config', 'upgrade'], function(code, out, err) {
          out.should.include('Error! get_latest called with version 0.9.2');
          code.should.equal(1);
          done();
        })

      })

    })

    describe('with a specific version as argument', function() {

     it('tries to fetch requested version', function(done) {

        run_cli(['config', 'upgrade', '1.2.3'], function(code, out, err) {
          out.should.include('Error! get_version called with version 1.2.3');
          code.should.equal(1);
          done();
        })

      });

    })

  })

})