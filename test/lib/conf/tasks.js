var fs      = require('fs'),
    join    = require('path').join,
    should  = require('should'),
    sinon   = require('sinon'),
    rimraf  = require('rimraf'),
    async   = require('async'),
    helpers = require('./../../helpers'),
    tmpdir  = require('os').tmpdir();

var getset  = require('getset');
var common  = require(helpers.lib_path('common'));
var tasks   = require(helpers.lib_path('conf', 'tasks'));
var vm      = require(helpers.lib_path('conf', 'shared', 'version_manager'));

var prey_user = require(helpers.lib_path('conf', 'tasks', 'prey_user'));

var hooks  = require(helpers.lib_path('conf', 'tasks', 'os', process.platform ));
var daemon = require(helpers.lib_path('conf', 'tasks', 'daemon'));

describe('tasks', function() {

  describe('activate', function() {

    describe('config', function() {

      var old_config,
          old_version_paths;

      before(function() {
        process.stdout.writable = false;

        // store old config so we can reset it afterwards
        old_config = common.config;

        // disable version paths for these tests
        old_version_paths = common.system.paths.versions;
        common.system.paths.versions = null;
      })

      after(function() {
        process.stdout.writable = true;

        common.config = old_config;
        common.system.paths.versions = old_version_paths;
      })

      var load_config = function(file) {
        return getset.load({ path: file, type: 'file' });
      }

      describe('with no existing config folder', function() {

        describe('and no write permissions', function() {

          before(function() {
            common.system.paths.config = '/foobar';
            load_config('/foobar/test.conf');
          })

          it('returns a EACCESS error', function(done) {
            tasks.activate({}, function(err) {
              should.exist(err);
              err.code.should.eql('EACCES');
              done();
            })
          })

        })

        describe('and write permissions', function() {

        var dir  = tmpdir + '/foobar',
            file = dir + '/test.conf';

          before(function(done) {
            common.system.paths.config = dir;
            common.config = load_config(file);

            // ok, now go
            tasks.activate({}, done);
          })

          after(function(done) {
            fs.unlink(file, function(err) {
              if (err) return done(err);
              fs.rmdir(dir, done);
            });
          })

          it('creates config dir', function() {
            fs.existsSync(dir).should.be.true;
          })

          it('generates a new config file', function() {
            fs.existsSync(file).should.be.true;
          })

        })

      })


      describe('with existing config folder', function() {

        var dir  = tmpdir + '/existing',
            file = dir + '/test.conf';

        before(function() {
          common.system.paths.config = dir;
          if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        })

        after(function(done) {
          fs.unlink(file, function(err) {
            if (err) return done(err);
            fs.rmdir(dir, done);
          });
        })

        describe('and nonexisting file', function() {

          before(function() {
            common.config = load_config(file);
            fs.existsSync(file).should.be.false;
          })

          describe('no write access to dir', function() {

            before(function() {
              fs.chmodSync(dir, '500');
            })

            it('returns an error', function(done) {
              tasks.activate({}, function(err) {
                should.exist(err);
                err.code.should.eql('EACCES');
                done();
              })
            })

          })

          describe('with write access to dir', function() {

            before(function(done) {
              fs.chmod(dir, 750, done);
            })

            it('generates a new config file', function(done) {
              // ok, now go
              tasks.activate({}, function(err) {
                fs.existsSync(file).should.be.true;
                done();
              })
            })

          })

        })

        describe('and existing file', function() {

          before(function() {
            // this was generated on last test, so just check
            fs.existsSync(file).should.be.true;
          })

          describe('no write access to file', function() {

            before(function(done) {
              fs.chmod(file, '000', done);
            })

            it('returns an error', function(done) {
              tasks.activate({}, function(err) {
                should.exist(err);
                err.code.should.eql('EACCES');
                done();
              })
            })

          })

          describe('with write access to file', function() {

            before(function(done) {
              fs.chmod(file, '750', done);
            })

            it('syncs and returns no errors', function(done) {
              // ok, now go
              tasks.activate({}, function(err) {
                should.not.exist(err);
                fs.existsSync(file).should.be.true;
                done();
              })
            })

          })

        })

      })

    })

    describe('current', function() {

      var sync;

      before(function() {
        sync = sinon.stub(common.config, 'sync', function(other_file, method, cb) { cb() } )
      })

      after(function() {
        sync.restore();
      })

      describe('with no versions support', function() {

        before(function() {
          common.system.paths.versions = null;
        })

        it('does not create a current symlink/dir', function(done) {
          var spy = sinon.spy(vm, 'set_current');

          // ok, now go
          tasks.activate({}, function(err) {
            should.not.exist(err);
            spy.called.should.be.false;
            spy.restore();

            var readlink = fs.realpathSync(common.system.paths.current);
            readlink.should.not.containEql('current');

            done();
          })
        })

      })

      describe('with versions support', function() {

        var dir = tmpdir + '/versions';

        before(function() {
          common.system.paths.versions = dir;
        })

        describe('and current version equals this version', function() {

          before(function() {
            vm.this().should.eql(vm.current());
          })

          it('stops there', function(done) {
            tasks.activate({}, function(err) {
              should.exist(err);
              err.message.should.containEql('is already set as current');
              done();
            })
          })

        })

        describe('and current version does not match this version', function() {

          var this_stub;

          before(function() {
            this_stub = sinon.stub(vm, 'this', function() { return '2.3.4' })
          })

          after(function() {
            this_stub.restore();
          })

          describe('and versions path does not exist', function() {

            before(function(done) {
              rimraf(dir, done);
              // fs.existsSync(dir).should.be.false;
            })

            it('fails miserably', function(done) {
              tasks.activate({}, function(err) {
                should.exist(err);
                err.message.should.match(/Path not found:.*\/versions\/2.3.4/);
                done();
              })
            })

          })

          describe('and versions path exists', function() {

            before(function(done) {
              fs.mkdir(dir, done);
            })

            after(function(done) {
              rimraf(dir, done);
            })

            describe('but specific version dir is not found', function() {

              it('fails miserably', function(done) {
                tasks.activate({}, function(err) {
                  should.exist(err);
                  err.message.should.match(/Path not found:.*\/versions\/2.3.4/);
                  done();
                })
              })

            })

            describe('and specific version dir is found', function() {

              var version_dir = dir + '/2.3.4';
              var install_dir = tmpdir + '/install';

              before(function(done) {
                fs.mkdir(version_dir, function(err) {
                  if (err) return done(err);

                  fs.writeFile(version_dir + '/package.json', JSON.stringify({ version: '2.3.4'}), done);
                });
              })

              after(function(done) {
                rimraf(version_dir, done)
              })

              describe('and no write access to install path', function() {

                before(function(done) {
                  common.system.paths.install = install_dir;
                  fs.mkdirSync(install_dir);
                  fs.chmod(install_dir, '000', done)
                })

                after(function(done) {
                  fs.rmdir(install_dir, done);
                })

                it('fails miserably', function(done) {
                  tasks.activate({}, function(err) {
                    should.exist(err);
                    err.code.should.match(/EPERM|EISDIR/);
                    done();
                  })
                })

              })

              describe('with write access to install path', function() {

                var current_dir = install_dir + '/current';

                before(function(done) {
                  common.system.paths.current = current_dir;
                  fs.existsSync(current_dir).should.be.false;

                  fs.mkdirSync(install_dir);
                  fs.chmod(install_dir, '750', done);
                })

                after(function(done) {
                  rimraf(install_dir, done);
                })

                it('creates a new current dir', function(done) {

                  // ok, now go
                  tasks.activate({}, function(err) {
                    should.not.exist(err);
                    fs.existsSync(current_dir);
                    done();
                  })

                })

              })

            })

          })

        });

      })

    })

  })

  describe('post_install', function() {

    var spy, stub;

    describe('stage one', function() {

      var sync_stub, old_versions_path;

      before(function() {
        // let's assume we have a versions path and that config.sync works
        // we're already testing the versions/no versions logic in .activate()
        old_versions_path = common.system.paths.versions;
        common.system.paths.versions = tmpdir + '/versions';

        sync_stub = sinon.stub(common.config, 'sync', function(other_file, method, cb) { cb() } )
      })

      after(function() {
        common.system.paths.versions = old_versions_path;
        sync_stub.restore();
      })

      describe('on windows', function() {

        var old_platform;

        before(function() {
          // force platform to win32
          old_platform = process.platform;
          process.platform = 'win32';
        })

        after(function() {
          // revert platform
          process.platform = old_platform;
        })

        describe('if activation returns error', function() {

          describe('and error is "already set as current"', function() {

            before(function() {
              stub = sinon.stub(vm, 'set_current', function(version, cb) {
                var err = new Error('Already current');
                err.code = 'ALREADY_CURRENT';
                cb(err);
              })
            })

            after(function() {
              stub.restore();
            })

            it('advances to stage two', function(done) {
              var async_stub = sinon.stub(async, 'series', function(fx_arr, cb) {
                return cb(new Error('async.series called.'));
              })

              tasks.post_install({}, function(err) {
                err.should.exist;
                err.message.should.eql('async.series called.');
                async_stub.restore();
                done();
              })
            })

          })

          describe('and error is something else', function() {

            before(function() {
              stub = sinon.stub(vm, 'set_current', function(version, cb) {
                var err = new Error('Foobar.');
                cb(err);
              })
            })

            after(function() {
              stub.restore();
            })

            it('does not advance to stage two', function(done) {
              var async_spy = sinon.spy(async, 'series');

              tasks.post_install({}, function(err) {
                async_spy.called.should.be.false;
                async_spy.restore();
                done();
              })
            })
          })

        })

        describe('if activation succeeds', function() {

          before(function() {
            stub = sinon.stub(vm, 'set_current', function(version, cb) { cb() });
          })

          after(function() {
            stub.restore();
          })

          it('advances to stage two', function(done) {
            var async_stub = sinon.stub(async, 'series', function(fx_arr, cb) {
              return cb(new Error('async.series called.'));
            })

            tasks.post_install({}, function(err) {
              async_stub.restore();
              err.should.exist;
              err.message.should.eql('async.series called.');
              done();
            })
          })

        })

      })

    })

    describe('non windows', function() {

      var old_platform;

      before(function() {
        // force platform to darwin
        old_platform = process.platform;
        process.platform = 'darwin';
      })

      after(function() {
        // revert platform
        process.platform = old_platform;
      })

      describe('if prey_user.create fails', function() {

        before(function() {
          stub = sinon.stub(prey_user, 'create', function(cb) { cb(new Error('Gave up')) });
        })

        after(function() {
          stub.restore();
        })

        it('does not advance to stage two', function(done) {
          var async_spy = sinon.spy(async, 'series');

          tasks.post_install({}, function(err) {
            async_spy.called.should.be.false;
            async_spy.restore();
            done();
          })
        })

      })

      describe('if prey_user.create succeeds', function() {

        before(function() {
          stub = sinon.stub(prey_user, 'create', function(cb) { cb() });
        })

        after(function() {
          stub.restore();
        })

        it('advances to stage two', function(done) {
          var async_stub = sinon.stub(async, 'series', function(fx_arr, cb) {
            return cb(new Error('async.series called.'));
          })

          tasks.post_install({}, function(err) {
            err.should.exist;
            err.message.should.eql('async.series called.');
            async_stub.restore();
            done();
          })
        })

      });

    })

    describe('stage two', function() {

      var create_user_stub;

      before(function() {
        // start by assuming that create user was ok
        create_user_stub = sinon.stub(prey_user, 'create', function(cb) { cb() });
      })

      after(function() {
        create_user_stub.restore();
      })

      describe('if daemon.install fails', function() {

        before(function() {
          stub = sinon.stub(daemon, 'install', function(cb) { cb(new Error('No daemons around.')) })
        })

        after(function() {
          stub.restore();
        })

        it('returns error', function(done) {
          tasks.post_install({}, function(err) {
            err.should.exist;
            err.message.should.eql('No daemons around.');
            done();
          })
        })

        it('does not run post_install hooks', function(done) {
          var async_spy = sinon.spy(hooks, 'post_install');

          tasks.post_install({}, function(err) {
            async_spy.called.should.be.false;
            async_spy.restore();
            done();
          })
        })

      })

      describe('if daemon.install works', function() {

        before(function() {
          stub = sinon.stub(daemon, 'install', function(cb) { cb() })
        })

        after(function() {
          stub.restore();
        })

        describe('and post_install hooks fails', function() {

          var hooks_stub;

          before(function() {
            hooks_stub = sinon.stub(hooks, 'post_install', function(cb) { cb(new Error('Not today')) })
          })

          after(function() {
            hooks_stub.restore();
          })

          it('returns error', function(done) {
            tasks.post_install({}, function(err) {
              err.should.exist;
              err.message.should.eql('Not today');
              done();
            })
          })

        })

        describe('and post_install hooks succeed', function() {

          var hooks_stub;

          before(function() {
            hooks_stub = sinon.stub(hooks, 'post_install', function(cb) { cb() })
          })

          after(function() {
            hooks_stub.restore();
          })

          it('returns no error', function(done) {
            tasks.post_install({}, function(err) {
              should.not.exist(err);
              done();
            })
          })

        })

      })

    })

  })

  describe('pre_uninstall', function() {

  })

  describe('hooks', function() {

    describe('windows', function() {

      var win_hooks = require(helpers.lib_path('conf', 'tasks', 'os', 'windows')),
          firewall  = require('firewall');

      describe('post_activate', function() {

        describe('if versions list is empty', function() {

          var stub;

          before(function() {
            stub = sinon.stub(vm, 'list', function() { return [] })
          })

          after(function() {
            stub.restore();
          })

         it('doesnt fail', function(done) {
            win_hooks.post_activate(function(err) {
              should.not.exist(err);
              done()
            })
          })

        })

        describe('if adding firewall rule fails', function() {

          var stub;

          before(function() {
            stub = sinon.stub(firewall, 'add_rule', function(obj, cb) {
              cb(new Error('Windows Firewall is taking a nap.'))
            })
          })

          after(function() {
            stub.restore();
          })

          it('doesnt return error', function(done) {
            win_hooks.post_activate(function(err) {
              should.not.exist(err);
              done()
            })
          })

        })

      })

      describe('post_install', function() {

      })

      describe('pre_uninstall', function() {

      })

    })

  })

})
