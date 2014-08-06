var join    = require('path').join,
    spawn   = require('child_process').spawn,
    should  = require('should'),
    sandbox = require('./../../utils/spawner_sandbox'),
    helpers = require('./../../helpers');

var conf_path = helpers.lib_path('conf'),
    prey_bin = join(__dirname, '..', '..', '..', 'bin', 'prey');

if (process.platform == 'win32')
  prey_bin = prey_bin + '.cmd';

describe('account', function() {

  var sb, 
      sandbox_file = join(conf_path, 'account.js');

  var run_cli = function(args, cb) {
    var out, err, child = spawn(prey_bin, args);
    child.stdout.on('data', function(data) { out += data });
    child.stderr.on('data', function(data) { err += data });
    child.on('exit', function(code) { cb(code, out, err) });
  };

  function sandbox_enable(opts, done) {

    var deps = {
      './shared' : {
        keys : {
          get: function() { return { api: 123456789, device: 123123 } }
        },
        panel : { 
          verify_keys: function(keys, cb) { 
            var str = [keys.api, keys.device].join(', ');
            return cb(new Error('Called with keys: ' + str))
          } 
        }
      }
    }

    sb = sandbox.put(sandbox_file, deps, done);
  }

  function sandbox_revert(done) {
    sb.release(done);
  }

  describe('verify', function() {

    before(function(done) {
      sandbox_enable({}, done);
    })

    after(sandbox_revert);

    describe('with --current param', function() {

      it('tries to verify current keys', function(done){

        run_cli(['config', 'account', 'verify', '--current'], function(code, out, err) {
          out.should.containEql('Called with keys: 123456789, 123123');
          done();
        })

      })

    })

    describe('with -c param', function() {

      it('tries to verify current keys', function(done){

        run_cli(['config', 'account', 'verify', '-c'], function(code, out, err) {
          out.should.containEql('Called with keys: 123456789, 123123');
          done();
        })

      })

    })

    describe('with --api-key and --email', function() {

      it('tries to verify passed keys', function(done){

        run_cli(['config', 'account', 'verify', '-a', 'foobar', '-d', '567567'], function(code, out, err) {
          out.should.containEql('Called with keys: foobar, 567567');
          done();
        })

      })

    });

  })

})