var fs      = require('fs'),
    path    = require('path'),
    async   = require('async'),
    sinon   = require('sinon'),
    should  = require('should'),
    ocelot  = require('ocelot'),
    extend  = require('node.extend'),
    child_p = require('child_process'),
    sandbox = require('sandboxed-module'),
    helpers = require('./../../../helpers');

var module_path = helpers.lib_path('conf', 'tasks', 'prey_user'),
    prey_user   = require(module_path);

describe('prey_user', function() {

  var run = function(cb) {
    run_sandboxed({}, cb);
  }

  var run_sandboxed = function(opts, cb) {
    var base = {
      singleOnly: true, // https://github.com/felixge/node-sandboxed-module/issues/36
      requires: {
        // let's assume that this guy will do his job.
        chela: {
          own: function(path, user, cb) {
            cb();
          }
        }
      },
      globals:  {
        process: {
          platform: 'linux' // by default, so we don't get stopped
        }
      }
    }

    var opts = extend(true, base, opts);
    var module = sandbox.require(module_path, opts);
    module.create(cb);
  }

  before(function() {
    process.stdout.writable = false;
  })

  after(function() {
    process.stdout.writable = true;
  })

  describe('when called on windows', function() {

    it('returns error', function(done) {
      var opts = { globals: { process: { platform: 'win32' } } };

      run_sandboxed(opts, function(err) {
        err.should.exist;
        err.message.should.containEql('This script is for Mac/Linux only');
        done();
      })
    })

  })

  describe('if user creation script fails', function() {

    var stub;

    before(function() {
      // stub the exec() call to create_user.sh
      stub = sinon.stub(child_p, 'exec', function(cmd, cb) {
        var err = new Error('Not today, Josephine.');
        err.code = 1;
        cb(err);
      })
    })

    after(function() {
      stub.restore();
    })

    it('returns an error', function(done) {
      run(function(err) {
        err.should.exist;
        err.message.should.containEql('Not today, Josephine.');
        done();
      })
    })

    it('does not setup permissions', function(done) {
      var spy = sinon.spy(fs, 'existsSync');

      run(function(err) {
        spy.called.should.be.false;
        spy.restore();
        done();
      })
    })

  })

  describe('if user creation script succeeds', function() {

    var stub;

    before(function() {
      // stub the exec() call to create_user.sh
      stub = sinon.stub(child_p, 'exec', function(cmd, cb) {
        cb();
      })
    })

    after(function() {
      stub.restore();
    })

    describe('and unable to create config dir', function() {

      var mkdir_stub;

      before(function() {
        mkdir_stub = sinon.stub(fs, 'mkdir', function(path, cb) {
          var err = new Error('Unable to create dir');
          err.code = 'EACCES';
          cb(err);
        })
      })

      after(function() {
        mkdir_stub.restore();
      })

      it('returns an error', function(done) {
        run(function(err) {
          err.should.exist;
          err.message.should.containEql('Unable to create dir');
          done();
        })
      })

      it('does not run "config activate" as prey user', function(done) {
        var spy = sinon.spy(ocelot, 'exec_as');

        run(function(err) {
          spy.called.should.be.false;
          spy.restore();
          done();
        })
      })

    })

    describe('and config dir is created', function() {

      var mkdir_stub;

      before(function() {
        mkdir_stub = sinon.stub(fs, 'mkdir', function(path, cb) {
          cb();
        })
      })

      after(function() {
        mkdir_stub.restore();
      })

      describe('but touching log file fails', function() {

        var writefile_stub;

        before(function() {
          writefile_stub = sinon.stub(fs, 'writeFile', function(path, data, cb) {
            var err = new Error('Big trouble');
            err.code = 'EACCES';
            cb(err);
          })
        })

        after(function() {
          writefile_stub.restore();
        })

        it('returns an error', function(done) {
          run(function(err) {
            err.should.exist;
            err.message.should.containEql('Big trouble');
            done();
          })
        })

        it('does not run "config activate" as prey user', function(done) {
          var spy = sinon.spy(ocelot, 'exec_as');

          run(function(err) {
            spy.called.should.be.false;
            spy.restore();
            done();
          })
        })

      })

      describe('and touching log file works', function() {

        // from here on we assume that the user has write access to do the chown'ing
        // that goes after the dir creation and log file touching. so let's set up those stubs.

        var writefile_stub, chown_stub;

        before(function() {
          writefile_stub = sinon.stub(fs, 'writeFile', function(path, data, cb) {
            cb();
          })

          chown_stub = sinon.stub(fs, 'chown', function(file, uid, gid, cb) {
            cb();
          })
        })

        after(function() {
          writefile_stub.restore();

          chown_stub.restore();
        })

        describe('and "config activate"', function() {

          it('returns an error', function(done) {

            var obj = {
              requires: {
                'ocelot': {
                  exec_as: function(user, cmd, cb) {
                    cb(new Error('Dont feel like it.'))
                  }
                }
              }
            }

            run_sandboxed(obj, function(err) {
              err.should.exist;
              err.message.should.containEql('Dont feel like it.');
              done();
            })
          })

        })

        describe('and "config activate" as prey user doesnt return error, but the result contains that string', function() {

          it('returns an error', function(done) {

            var obj = {
              requires: {
                'ocelot': {
                  exec_as: function(user, cmd, cb) {
                    var out = 'Error! I dont like your name ' + user;
                    cb(null, out);
                  }
                }
              }
            }

            run_sandboxed(obj, function(err) {
              err.should.exist;
              err.message.should.containEql('Activation failed'); // manually set
              done();
            })
          })

        })

        describe('and "config activate" as prey user succeeds', function() {

          it('works', function(done) {

            var obj = {
              requires: {
                'ocelot': {
                  exec_as: function(user, cmd, cb) {
                    // let's determine that it worked based
                    // on whether the bin path is correct
                    var bin = cmd.split(' ')[0];

                    if (cmd.match('config activate') && fs.existsSync(bin)) {
                      var out = 'It worked!';
                      cb(null, out);
                    } else {
                      var out = 'Failed miserably. Error.';
                      cb(null, out);
                    }
                  }
                }
              }
            }

            run_sandboxed(obj, function(err) {
              should.not.exist(err);
              done();
            })
          })

        })

      })

    })

  })

})
