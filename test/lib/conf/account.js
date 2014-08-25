var join    = require('path').join,
    spawn   = require('child_process').spawn,
    should  = require('should'),
    sandbox = require('./../../utils/spawner_sandbox'),
    helpers = require('./../../helpers');

describe('account', function() {

  var sb, 
      sandbox_file = join(conf_path, 'account.js');

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


  describe('account', function() {

    describe('authorize', function() {

      before(function(done) {
        // var obj = { './account': {} }

        var obj = { 
          './../common': {
            config: {
              get: mirror,
              writable: function(cb) { return cb(true) }
            }
          }
        }

        sandbox_enable(obj, done)
      })

      after(sandbox_revert);

      describe('with no params', function() {

        it('shows usage', function(done) {
          helpers.run_cli(['config', 'account', 'authorize'], function(code, out) {
            out.should.containEql('config account authorize');
            out.should.containEql('-a, --api-key');
            done()
          })
        })

      })

      describe('with missing params (email but no passwd)', function() {

        it('returns error', function(done) {
          helpers.run_cli(['config', 'account', 'authorize', '--email', 'foobar@test.com'], function(code, out) {
            code.should.eql(1);
            out.should.containEql('Password required');
            done()
          })
        })

      })

      describe('with valid params', function() {

        var local_sb,
            file = './lib/conf/account.js';

        before(function(done) {
          var deps = {
            './shared': {
              panel: {
                authorize: function(opts, cb) {
                  return cb(new Error('panel.authorize called with opts: ' + JSON.stringify(opts)))
                }
              }
            }
          }
          local_sb = sandbox.put(file, deps, done);
        })

        after(function(done) {
          local_sb.release(done);
        })

        it('works with email and password', function(done) {
          helpers.run_cli(['config', 'account', 'authorize', '--email', 'hola@test.com', '-p', 'abcdef'], function(code, out) {
            code.should.eql(1);
            out.should.containEql('panel.authorize called with opts');
            out.should.containEql('{"username":"hola@test.com","password":"abcdef"}');
            done()
          })
        })

        it('works with api-key', function(done) {
          helpers.run_cli(['config', 'account', 'authorize', '--api-key', '123123123123'], function(code, out) {
            code.should.eql(1);
            out.should.containEql('panel.authorize called with opts');
            out.should.containEql('{"username":"123123123123","password":"x"}');
            done()
          })
        })

      })

    })

  })

  describe('verify', function() {

    before(function(done) {
      sandbox_enable({}, done);
    })

    after(sandbox_revert);

    describe('with --current param', function() {

      it('tries to verify current keys', function(done){

        helpers.run_cli(['config', 'account', 'verify', '--current'], function(code, out, err) {
          out.should.containEql('Called with keys: 123456789, 123123');
          done();
        })

      })

    })

    describe('with -c param', function() {

      it('tries to verify current keys', function(done){

        helpers.run_cli(['config', 'account', 'verify', '-c'], function(code, out, err) {
          out.should.containEql('Called with keys: 123456789, 123123');
          done();
        })

      })

    })

    describe('with --api-key and --email', function() {

      it('tries to verify passed keys', function(done){

        helpers.run_cli(['config', 'account', 'verify', '-a', 'foobar', '-d', '567567'], function(code, out, err) {
          out.should.containEql('Called with keys: foobar, 567567');
          done();
        })

      })

    });

  })

})