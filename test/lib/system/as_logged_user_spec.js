var fs          = require('fs'),
    join        = require('path').join,
    should      = require('should'),
    sinon       = require('sinon'),
    helpers     = require('../../helpers'),
    system      = require(helpers.lib_path('system')),
    is_windows  = process.platform === 'win32';

if (!is_windows && process.getuid() !== 0) {
  console.log('\nThe impersonation tests should be run as root.');
  console.log('Please run `sudo mocha test/lib/system/as_logged_user_spec.js.` to run them separately.');
  return;
}

describe('as_logged_user()', function(){

  var stub,
      logged_user_stub,
      current_user = process.env.USER;

  describe('run', function() {

    function run(cmd, args, cb) {
      system.run_as_logged_user(cmd, args, cb);
    }

    describe('when no user is logged in ', function() {

      before(function() {
        logged_user_stub = sinon.stub(system, 'get_logged_user', function(cb) {
          cb(new Error('No logged user found'));
        })
      })

      after(function() {
        logged_user_stub.restore();
      })

      it('stops with error', function(done) {
        run('cat /etc/passwd', [], function(err, out) {
          err.should.be.a.Error;
          err.message.should.eql('No logged user found');
          done();
        })
      })

    })

    describe('with logged user', function() {

      describe('and logged user == running user', function() {

        before(function() {
          logged_user_stub = sinon.stub(system, 'get_logged_user', function(cb) {
            cb(null, current_user);
          })
        })

        after(function() {
          logged_user_stub.restore();
        })

        describe('when command does not exist', function() {

          it('blows', function(done) {
            // let's try to run something that doesn't nor will ever exist
            run('bugless_windows', [], function(err, out) {
              err.should.be.a.Error;
              err.message.should.containEql('not found');
              done();
            })
          })

        })

        describe('when command exists', function() {

          it('works', function(done) {
            run('whoami', [], function(err, out) {
              should.not.exist(err);
              out.toString().trim().should.eql(current_user);
              done();
            })
          })

        })

      })

      describe('when logged user != running user', function() {

        var logged_user;

        before(function() {
          logged_user = 'prey';
          logged_user_stub = sinon.stub(system, 'get_logged_user', function(cb) {
            cb(null, logged_user);
          })
        })

        after(function() {
          logged_user_stub.restore();
        })

        describe('when command does not exist', function() {

          it('blows', function(done) {
            // let's try to run something that doesn't nor will ever exist
            run('bugless_windows', [], function(err, out) {
              err.should.be.a.Error;

              // TODO: check this weird thing. when running
              // as root we get a unhandled error event
              // but when running as user we get the right 'not found' error message

              // err.message.should.containEql('not found');
              err.message.should.containEql('ENOENT');
              done();
            })
          })

        })

        describe('when command exists', function() {

          describe('with node binary in /bin', function() {

            before(function() {
              stub = sinon.stub(fs, 'existsSync', function() { return true });
            })

            after(function() {
              stub.restore();
            })

            it('works', function(done) {
              run('whoami', [], function(err, out) {
                should.not.exist(err);
                out.toString().trim().should.eql(logged_user);
                done();
              })
            })

          })

          describe('with no node binary in /bin', function() {

            before(function() {
              stub = sinon.stub(fs, 'existsSync', function() { return false });
            })

            after(function() {
              stub.restore();
            })

            it('works', function(done) {
              run('whoami', [], function(err, out) {
                should.not.exist(err);
                out.toString().trim().should.eql(logged_user);
                done();
              })
            })

          })

        })

      })

    })

  });

  describe('spawn', function() {

    function run(cmd, args, cb) {
      system.spawn_as_logged_user(cmd, args, function(err, child) {
        if (err) return cb(err, child);

        var out = '';

        child.stdout.on('data', function(data) {
          out += data;
        })

        child.on('error', function(err) {
          cb(err, out);
        })

        child.on('exit', function() {
          cb(err, out);
        })
      });
    }

    describe('when no user is logged in ', function() {

      before(function() {
        logged_user_stub = sinon.stub(system, 'get_logged_user', function(cb) {
          cb(new Error('No logged user found'));
        })
      })

      after(function() {
        logged_user_stub.restore();
      })

      it('stops with error', function(done) {
        run('cat /etc/passwd', [], function(err, out) {
          err.should.be.a.Error;
          err.message.should.eql('No logged user found');
          done();
        })
      })

    })

    describe('with logged user', function() {

      describe('and logged user == running user', function() {

        before(function() {
          logged_user_stub = sinon.stub(system, 'get_logged_user', function(cb) {
            cb(null, current_user);
          })
        })

        after(function() {
          logged_user_stub.restore();
        })

        describe('when command does not exist', function() {

          it('blows', function(done) {
            // let's try to run something that doesn't nor will ever exist
            run('bugless_windows', [], function(err, out) {
              err.should.be.a.Error;
              err.code.should.eql('ENOENT');
              done();
            })
          })

        })

        describe('when command exists', function() {

          it('works', function(done) {
            run('whoami', [], function(err, out) {
              should.not.exist(err);
              out.toString().trim().should.eql(current_user);
              done();
            })
          })

        })

      })

      describe('when logged user != running user', function() {

        var logged_user;

        before(function() {
          logged_user = 'prey';
          logged_user_stub = sinon.stub(system, 'get_logged_user', function(cb) {
            cb(null, logged_user);
          })
        })

        after(function() {
          logged_user_stub.restore();
        })

        describe('when command does not exist', function() {

          it('blows', function(done) {
            // let's try to run something that doesn't nor will ever exist
            run('bugless_windows', [], function(err, out) {
              err.should.be.a.Error;

              // TODO: check this weird thing. when running
              // as root we get a unhandled error event
              // but when running as user we get the right 'not found' error message

              // err.message.should.containEql('not found');
              err.code.should.eql('ENOENT');
              done();
            })
          })

        })

        describe('when command exists', function() {

          describe('with node binary in /bin', function() {

            before(function() {
              stub = sinon.stub(fs, 'existsSync', function() { return true });
            })

            after(function() {
              stub.restore();
            })

            it('works', function(done) {
              run('whoami', [], function(err, out) {
                should.not.exist(err);
                out.toString().trim().should.eql(logged_user);
                done();
              })
            })

          })

          describe('with no node binary in /bin', function() {

            before(function() {
              stub = sinon.stub(fs, 'existsSync', function() { return false });
            })

            after(function() {
              stub.restore();
            })

            it('works', function(done) {
              run('whoami', [], function(err, out) {
                should.not.exist(err);
                out.toString().trim().should.eql(logged_user);
                done();
              })
            })

          })

        })

      })

    })

  })

})
