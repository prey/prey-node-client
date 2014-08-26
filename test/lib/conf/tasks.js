var fs      = require('fs'),
    join    = require('path').join,
    should  = require('should'),
    sinon   = require('sinon'),
    async   = require('async'),
    getset  = require('getset'),
    rimraf  = require('rimraf'),
    helpers = require('./../../helpers'),
    tmpdir  = require('os').tmpdir();

var os_name = process.platform.replace('win32', 'windows').replace('darwin', 'mac');

var common  = require(helpers.lib_path('common')),
    tasks   = require(helpers.lib_path('conf', 'tasks')),
    vm      = require(helpers.lib_path('conf', 'shared', 'version_manager'));

var prey_user = require(helpers.lib_path('conf', 'tasks', 'prey_user')),
    hooks   = require(helpers.lib_path('conf', 'tasks', 'os', os_name )),
    daemon  = require(helpers.lib_path('conf', 'tasks', 'daemon'));

var firewall  = require('firewall');

describe('tasks', function() {

    var old_config,
        old_versions_path;

    before(function() {
      process.stdout.writable = false;

      // store old config so we can reset it afterwards
      old_config = common.config;

      // disable version paths for these tests
      old_versions_path = common.system.paths.versions;
      common.system.paths.versions = null;
    })

    after(function() {
      process.stdout.writable = true;

      common.config = old_config;
      common.system.paths.versions = old_versions_path;
    })

  if (os_name == 'windows') {

    var firewall_stubs = {};

    before(function() {
      firewall_stubs.add = sinon.stub(firewall, 'add_rule', function(obj, cb) { cb() })
      firewall_stubs.del = sinon.stub(firewall, 'remove_rule', function(obj, cb) { cb() })
    })

    after(function() {
      firewall_stubs.add.restore()
      firewall_stubs.del.restore();
    })

  }

  describe('activate', function() {

/*
    var os_hooks;

    before(function() {
      os_hooks = sinon.stub(hooks, 'post_activate', function(cb) { return cb() })
    })

    after(function() {
      os_hooks.restore();
    })
*/

    describe('config', function() {

      var load_config = function(file) {
        return getset.load({ path: file, type: 'file' });
      }

      describe('with no existing config folder', function() {

        describe('and no write permissions', function() {

          before(function() {
            var dir = tmpdir + '/stubbed';
            common.system.paths.config = dir;
            load_config(dir + '/test.conf');

            fs.existsSync(dir).should.be.false;
          })

          it('returns a EACCES error', function(done) {

            var stub_mkdir = sinon.stub(fs, 'mkdir', function(dir, cb) {
              var err = new Error('EACCES: ' + dir);
              err.code = 'EACCES';
              cb(err)
            })

            tasks.activate({}, function(err) {
              should.exist(err);
              err.code.should.eql('EACCES');
              stub_mkdir.restore();     
              done();
            })
          })

        })

        describe('and write permissions', function() {

        var dir  = join(tmpdir, 'writable'),
            file = join(dir, 'test.conf');

          before(function(done) {
            common.system.paths.versions = null;

            common.system.paths.config = dir;
            common.config = load_config(file);

            if (fs.existsSync(dir)) {
              fs.unlinkSync(dir);
            }

            fs.existsSync(dir).should.be.false;

            // ok, now go
            tasks.activate({}, function(err) {
              should.not.exist(err);
              done();
            });
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

        var dir  = join(tmpdir, 'existing'),
            file = join(dir, 'test.conf')

        before(function() {
          common.system.paths.config = dir;
          if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        })

        after(function(done) {
          rimraf(dir, done);
        })

        describe('and nonexisting file', function() {

          before(function() {
            common.config = load_config(file);

            if (fs.existsSync(file)) {
              fs.unlinkSync(file);
            }

            fs.existsSync(file).should.be.false;
          })

          describe('no write access to dir', function() {

            var stub_write;

            before(function() {
              stub_write = sinon.stub(fs, 'writeFile', function(file, data, cb) {
                var err = new Error('EACCES: ' + dir);
                err.code = 'EACCES';
                cb(err)
              })
            })

            after(function() {
              stub_write.restore();
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

            it('generates a new config file', function(done) {
              tasks.activate({}, function(err) {
                fs.existsSync(file).should.be.true;
                done();
              })
            })

          })

        })

        describe('and existing file', function() {

          before(function(done) {
            common.config = load_config(file);
            fs.writeFile(file, 'foo = bar\n', done);
          })

          describe('no write access to file', function() {

            var stub_write;

            before(function() {
              stub_write = sinon.stub(fs, 'writeFile', function(file, data, cb) {
                var err = new Error('EACCES: ' + dir);
                err.code = 'EACCES';
                cb(err)
              })
            })

            after(function() {
              stub_write.restore();
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
                err.message.should.match(/Path not found:.*versions.?2.3.4/);
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
                  err.message.should.match(/Path not found:.*versions.?2.3.4/);
                  done();
                })
              })

            })

            describe('and specific version dir is found', function() {

              var version_dir = join(dir, '/2.3.4');
              var install_dir = join(tmpdir, 'install');

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

                  if (!fs.existsSync(install_dir))
                    fs.mkdirSync(install_dir);

                  fs.chmod(install_dir, '0000', done)
                })

                after(function() {
                  if (fs.existsSync(install_dir)) {
                    fs.chmodSync(install_dir, '0750')
                    fs.rmdirSync(install_dir);
                  }
                })

                it('fails miserably', function(done) {
                  tasks.activate({}, function(err) {
                    should.exist(err);
                    err.code.should.match(/EPERM|EISDIR|EBUSY/);
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

    // stub hooks

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

    })

    describe('stage two', function() {

      var create_user_stub;

      before(function() {
        // if running under win32, skip the set_up_version logic 
        if (process.platform == 'win32') {
          stage_one_stub = sinon.stub(vm, 'set_current', function(ver, cb) { cb() });
        } else {
          // if running not on windows, skip create user part
          stage_one_stub = sinon.stub(prey_user, 'create', function(cb) { cb() });
        }
      })

      after(function() {
        stage_one_stub.restore();
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

      var win_hooks = require(helpers.lib_path('conf', 'tasks', 'os', 'windows'));

      // if we're actually running on windows, reset the FW stubs
      if (os_name == 'windows') {
        before(function() {
          firewall_stubs.add.restore();
        })
      }

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
