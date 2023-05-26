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

describe('config cli arguments', function() {

  var sb,
      sandbox_file = './lib/conf/cli.js';

  function sandbox_enable(opts, vars, done) {
    var base = { './../common': common_base };
    var deps = extend(true, base, opts); // deep merge
    sb = sandbox.put(sandbox_file, deps, vars, done);
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

    var getuid = null;

    var enable_tasks_sandbox = function(cb) {
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

      var global_obj = {
        process: {
          getuid: getuid
        }
      }

      sandbox_enable(obj, global_obj, cb);
    }

    // used in the pre_install tests, but useful helper for other situations
    var toggle_sandbox = function(done) {
      sandbox_revert(function() {
        enable_tasks_sandbox(done);
      })
    }

    before(enable_tasks_sandbox);
    after(sandbox_revert);

    describe('activate', function() {

      describe('with no arguments', function() {
        it('calls tasks.activate', function(done) {
          helpers.run_cli(['config', 'activate'], function(code, out) {
            code.should.eql(1);
            out.should.containEql(' activate called: {"positional":[]}');
            done();
          })
        })
      })

    })

    describe('post_install', function() {

      var run = function(args, code, out_string, cb) {
        helpers.run_cli(args, function(code, out) {
          code.should.eql(code);
          out.should.containEql(out_string);
          cb();
        })
      }

      var run_test = function(code, out_string, cb) {
        run(['config', 'hooks', 'post_install'], code, out_string, cb);
      }

      describe('on windows', function() {

        // make sure getuid is null, and reset sandbox
        before(function(done) {
          getuid = null;
          toggle_sandbox(done);
        })

        it('works', function(done) {
          run_test(0, 'post_install called', done);
        });

      })

      describe('on linux/mac', function() {

        // this guy will release the sandbox and set up a new one
        // using the getuid changes that we want. once we're done,
        // we don't really need to revert the sandbox to its initial position
        // so no need to do an after() thingy.

        describe('as non-root', function() {

          before(function(done) {
            getuid = function() { return 100 };
            toggle_sandbox(done);
          })

          describe('if running via npm', function() {

            before(function() {
              process.env.npm_package_version = '1.2.3';
            })

            it('shows an error, but returns with code 0', function(done) {
              run_test(0, 'To continue with the install process', done);
            })

          })

          describe('not via NPM', function() {

            before(function() {
              delete process.env.npm_package_version;
              delete process.env.npm_lifecycle_script;
            })

            it('shows an error, but returns with code 0', function(done) {
              run_test(0, 'To continue with the install process', done);
            })

          })

        })

        describe('as root', function() {

          before(function(done) {
            getuid = function() { return 0 };
            toggle_sandbox(done);
          })

          it('works', function(done) {
            run_test(0, 'post_install called', done);
          });

        })

      })

    })

    describe('pre_uninstall', function() {

      var run = function(args, out_string, cb) {
        helpers.run_cli(args, function(code, out) {
          code.should.eql(1);
          out.should.containEql(out_string);
          cb();
        })
      }

      var run_test = function(out_string, cb) {
        // with no arguments
        run(['config', 'hooks', 'pre_uninstall'], out_string, function() {
          // with --updating argument
          run(['config', 'hooks', 'pre_uninstall', '--updating', '1'], out_string, cb);
        })
      }

      describe('on windows', function() {

        // make sure getuid is null, and reset sandbox
        before(function(done) {
          getuid = null;
          toggle_sandbox(done);
        })

        it('works', function(done) {
          run_test('pre_uninstall called', done);
        });

      })

      describe('on linux/mac', function() {

        // this guy will release the sandbox and set up a new one
        // using the getuid changes that we want. once we're done,
        // we don't really need to revert the sandbox to its initial position
        // so no need to do an after() thingy.

        describe('as non-root', function() {

          before(function(done) {
            getuid = function() { return 100 };
            toggle_sandbox(done);
          })

          describe('running via npm', function() {

            before(function() {
              process.env.npm_package_version = '1.2.3';
            })

            it('shows an error', function(done) {
              run_test('without the --unsafe-perm flag', done);
            })

          })

          describe('not via npm', function() {

            before(function() {
              delete process.env.npm_package_version;
              delete process.env.npm_lifecycle_script;
            })

            it('works', function(done) {
              run_test('pre_uninstall called', done);
            });

          })

        })

        describe('as root', function() {

          before(function(done) {
            getuid = function() { return 0 };
            toggle_sandbox(done);
          })

          it('works', function(done) {
            run_test('pre_uninstall called', done);
          });

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

      sandbox_enable(obj, {}, done)
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
              panel:{
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
          var attrs = ['--name', 'User', '--email', 'some@one.com', '--password', 'buenaonda', '--terms', 'yes', '--age', 'yes'];

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
