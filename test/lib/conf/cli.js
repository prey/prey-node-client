var join    = require('path').join,
    spawn   = require('child_process').spawn,
    should  = require('should'),
    sandbox = require('./../../utils/spawner_sandbox'),
    helpers = require('./../../helpers'),
    extend  = require('node.extend');

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

  var sb,
      sandbox_file = './lib/conf/cli.js';

  function sandbox_enable(opts, done) {
    var base = { './../common': common_base };
    var deps = extend(true, base, opts); // deep merge
    sb = sandbox.put(sandbox_file, deps, done);
  }

  function sandbox_revert(done) {
    sb.release(done);
  }

  describe('when no arguments are passed', function() {
    var res = {};

    before(function(done) {
      helpers.run_cli(['config'], function(code, out, err) {
        res.code = code;
        res.out  = out;
        done();
      })
    })

    it('shows help and exits', function() {
      res.out.should.containEql('cli.js config [command]');
      res.out.should.containEql('Prey account management');
      res.out.should.containEql('configure installed plugins');
    })

    it('returns status code 2', function() {
      res.code.should.eql(2);
    })

  })

  describe('tasks', function() {

    before(function(done) {
      var obj = { 
        './tasks': { 
          activate: function(values, cb) { 
            return cb(new Error('activate called: ' + JSON.stringify(values)));
          },
          post_install: function(values, cb) { 
            return cb(new Error('post_install called: ' + JSON.stringify(values)));
          },
          pre_uninstall: function(values, cb) { 
            return cb(new Error('pre_uninstall called: ' + JSON.stringify(values)));
          }
        }
      }

      sandbox_enable(obj, done);
    })

    after(sandbox_revert);

    describe('activate', function() {
      it('calls tasks.activate', function(done) {
        helpers.run_cli(['config', 'activate'], function(code, out) {
          code.should.eql(1);
          out.should.containEql(' activate called: {"positional":[]}');
          done();
        })
      })
    })

/*
    describe('post_install', function() {
      it('calls tasks.activate', function(done) {
        helpers.run_cli(['config', 'hooks', 'post_install'], function(code, out) {
          code.should.eql(1);
          out.should.containEql(' post_install called: {"positional":[]}');
          done();
        })
      })
    })
*/

    describe('pre_uninstall', function() {
      it('calls tasks.activate', function(done) {
        helpers.run_cli(['config', 'hooks', 'pre_uninstall', '--updating', '1'], function(code, out) {
          code.should.eql(1);
          out.should.containEql('pre_uninstall called: {"positional":["1"],"-u":true');
          done();
        })
      })
    })

  })

  describe('gui', function(){

    describe('check_and_show', function() {

      it('pending')

    })

    describe('show_and_exit', function() {

      it('pending')

    })

  })

  describe('account', function() {

    var local_sb,
        local_file = './lib/conf/account.js';

    before(function(done) {
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

    describe('authorize', function() {

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
          local_sb = sandbox.put(local_file, deps, done);
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

    describe('verify', function() {

      before(function(done) {
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

        local_sb = sandbox.put(local_file, deps, done);
      })

      after(function(done) {
        local_sb.release(done);
      });

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

    describe('signup', function() {

      describe('with no params', function() {

        it('shows usage', function(done) {
          helpers.run_cli(['config', 'account', 'signup'], function(code, out) {
            out.should.containEql('config account signup');
            out.should.containEql('-n, --name');
            out.should.containEql('-p, --password');
            done()
          })
        })

      })

      describe('when account is already set up', function() {

        before(function(done) {
          var deps = {
            './shared': {
              keys: {
                is_api_key_set: function() { return true }
              }
            }
          }
          local_sb = sandbox.put(local_file, deps, done);
        })

        after(function(done) {
          local_sb.release(done);
        })

        it('returns an error', function(done) {
          var attrs = ['--name', 'User', '--email', 'some@one.com', '--password', 'buenaonda'];

          helpers.run_cli(['config', 'account', 'signup'].concat(attrs), function(code, out) {
            code.should.eql(1);
            out.should.containEql('Account already set up');
            done()
          })
        })

      })

      describe('with no account set up', function() {

        before(function(done) {
          var deps = {
            './shared': {
              keys: {
                is_api_key_set: function() { return false }
              }, 
              panel: {
                signup: function(opts, cb) {
                  return cb(new Error('panel.signup called with opts: ' + JSON.stringify(opts)))
                }
              }
            }
          }
          local_sb = sandbox.put(local_file, deps, done);
        })

        after(function(done) {
          local_sb.release(done);
        })

        it('sends signup request', function(done) {
          var attrs = ['--name', 'User', '--email', 'some@one.com', '--password', 'buenaonda'];

          helpers.run_cli(['config', 'account', 'signup'].concat(attrs), function(code, out, err) {
            console.log(err);
            code.should.eql(1);
            out.should.containEql('panel.signup called with opts');
            out.should.containEql('{"name":"User","email":"some@one.com"');
            done()
          })
        })

      })

    })

  })

})
