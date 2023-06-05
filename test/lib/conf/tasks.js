var fs      = require('fs'),
    join    = require('path').join,
    should  = require('should'),
    sinon   = require('sinon'),
    async   = require('async'),
    getset  = require('getset'),
    rimraf  = require('rimraf'),
    helpers = require('./../../helpers'),
    api_path = join(helpers.lib_path('agent', 'plugins', 'control-panel', 'api')),
    api      = require(api_path),
    request  = require(join(api_path, 'request')),
    shared   = require(helpers.lib_path('conf', 'shared')),
    tmpdir   = require('os').tmpdir(),
    clear_folders = require(helpers.lib_path('conf', 'tasks', 'clear_folders')),
    clear_files_temp = require(helpers.lib_path('conf', 'tasks', 'clear_files_prey_temp'));

var os_name = process.platform.replace('win32', 'windows').replace('darwin', 'mac');

var common  = require(helpers.lib_path('common')),
    tasks   = require(helpers.lib_path('conf', 'tasks')),
    vm      = require(helpers.lib_path('conf', 'shared', 'version_manager'));

var prey_user = require(helpers.lib_path('conf', 'tasks', 'prey_user')),
    hooks   = require(helpers.lib_path('conf', 'tasks', 'os', os_name )),
    daemon  = require(helpers.lib_path('conf', 'tasks', 'daemon'));

var firewall  = require('firewall');

var chmod_counter = 0;

// save original chmordr function
chmodr_original = tasks.chmodr;
chmodr = chmodr_original;

describe('tasks', function() {

    var old_config,
        old_versions_path,
        chmod_stub;

    before(function() {
      process.stdout.writable = false;

      // store old config so we can reset it afterwards
      old_config = common.config;

      // disable version paths for these tests
      old_versions_path = common.system.paths.versions;
      common.system.paths.versions = null;

      stub_chmod();
    });

    after(function() {
      process.stdout.writable = true;

      common.config = old_config;
      common.system.paths.versions = old_versions_path;

      // restore chmodr function
      tasks.chmodr = chmodr_original;
      chmod_counter = 0;
    })

    function stub_chmod() {
      tasks.chmodr = function(path, code, cb) {
        chmod_counter++;
        cb();
      }
    }

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

            var stub_mkdir = sinon.stub(fs, 'mkdir').callsFake((dir, cb) => {
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
              stub_write = sinon.stub(fs, 'writeFile').callsFake((file, data, cb) => {
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
              stub_write = sinon.stub(fs, 'writeFile').callsFake((file, data, cb) => {
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
        sync = sinon.stub(common.config, 'sync').callsFake((other_file, method, cb) => { cb() } )
      })

      after(function() {
        sync.restore();
      })

      describe('with no versions support', function() {

        var old_current;

        before(function(done) {
          common.system.paths.versions = null;

          old_current = common.system.paths.current;
          common.system.paths.current = join(tmpdir, "foobar");

          var dir = common.system.paths.current;

          var createDirStructure = function (base_dir) {
            fs.mkdir(base_dir, function () {
              fs.mkdir(join(base_dir, "bin"), function () {
                var preyBinDir = join(__dirname, "..", "..", "..","bin", "prey");
                var tempBinDir = join(base_dir, "bin", "prey");
                fs.link(join(__dirname, "..", "..", "..","bin", "prey"), join(base_dir, "bin", "prey"), function (err) {
                  if (err) { console.log(err) }
                  done();
                });
              });
            });
          }

          let exists = fs.existsSync(dir);
          if (exists) {
            rimraf(dir, function () {
              createDirStructure(dir);
            });
          } else {
            createDirStructure(dir);
          }
        });

        after(function(done) {
          rimraf(common.system.paths.current, done)
          common.system.paths.current = old_current;
        });

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

        it('calls chownr', function(done) {
          tasks.activate({}, function(err) {
            chmod_counter.should.be.not.eql(0);
            done();
          });
        })

        describe('with write access to paths.current', function() {

          before(function(done) {
            tasks.chmodr = chmodr_original;
            fs.chmod(common.system.paths.current, '0755', function () {
              fs.chmod(join(common.system.paths.current, "bin", "prey"), '0644', done);
            });

          })

          after(stub_chmod);

          it('chmods files to 100755 (0755)', function(done) {
            tasks.activate({}, function(err) {
              should.not.exist(err);
              var stat  = fs.lstatSync(join(common.system.paths.current, "bin", "prey"));
              var intMode = stat.mode.toString(8);
              intMode.should.eql('100755'); // stat -f %p
              done();
            });
          })

        })

        describe('with NO write access to paths.current', function() {

          before(function(done) {
            tasks.chmodr = chmodr_original;
            fs.chmod(common.system.paths.current, '0200', done);
          })

          after(function(done) {
            stub_chmod();
            fs.chmod(common.system.paths.current, '0755', done);
          })

          it('returns a EPERM error', function(done) {
            tasks.activate({}, function(err) {
              should.exist(err);
              err.code.should.eql('EACCES');
              done();
            });
          })

        })

      })

      describe('with versions support', function() {
        let sharedVersionManager;
        let clearFolderStart;
        let clearFolderTempStart;
        var dir = join(tmpdir, 'versions');

        before(function() {
          common.system.paths.versions = dir;
        })

        describe('and current version equals this version', function() {

          before(function() {
            clearFolderStart = sinon.stub(clear_folders, 'start').callsFake(
              (cb) => {
              return cb(); 
            });
            clearFolderTempStart = sinon.stub(clear_files_temp, 'start').callsFake(
              (cb) => {
              return cb(); 
            });
            sharedVersionManager = sinon.stub(shared.version_manager, 'set_current').callsFake(
              (version, cb) => {
              return cb(null); 
            });
          }); //   vm.this().should.eql(vm.current());
          after(()=>{
            sharedVersionManager.restore();
          });

          it('doesnt stop, but shows warning', function(done) {
            tasks.activate({}, function(err, out) {
              should.not.exist(err);
              done();
            })
          })

        })

        describe('and current version does not match this version', function() {

          var this_stub;

          before(function() {
            this_stub = sinon.stub(vm, 'this').callsFake(() => { return '2.3.4' })
          })

          after(function() {
            this_stub.restore();
          })

          describe('and versions path does not exist', function() {

            before(function(done) {
              rimraf(dir, done);
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

              var version_dir, install_dir;

              before(function(done) {

                version_dir = join(dir, '2.3.4');
                install_dir = join(tmpdir, 'install');

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
                  // Reset counter
                  chmod_counter = 0
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

                it('does not chmod anything', function(done) {
                  tasks.chmodr = chmodr_original;
                  tasks.activate({}, function(err) {
                    chmod_counter.should.be.eql(0);
                    done();
                  })
                })

              })

              describe('with write access to install path', function() {

                var current_dir;

                before(function(done) {
                  current_dir = join(install_dir, 'current');

                  common.system.paths.current = current_dir;
                  fs.existsSync(current_dir).should.be.false;

                  fs.mkdirSync(install_dir);
                  fs.chmod(install_dir, '750', done);
                })

                after(function(done) {
                  rimraf(install_dir, done);
                })

                it('chmods files to 100755 (0755)', function(done) {

                  tasks.chmodr = chmodr_original;
                  tasks.activate({}, function(err) {
                    should.not.exist(err);
                    var stat  = fs.lstatSync(join(common.system.paths.current, "package.json"));
                    var intMode = stat.mode.toString(8);
                    intMode.should.eql('100755'); // stat -f %p
                    stub_chmod();
                    done();
                  });

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
        common.system.paths.versions = join(tmpdir, 'versions');

        sync_stub = sinon.stub(common.config, 'sync').callsFake((other_file, method, cb) => { cb() } )
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
              stub = sinon.stub(vm, 'set_current').callsFake((version, cb) => {
                var err = new Error('Already current');
                err.code = 'ALREADY_CURRENT';
                cb(err);
              })
            })

            after(function() {
              stub.restore();
            })

            it('advances to stage two', function(done) {
              var async_stub = sinon.stub(async, 'series').callsFake((fx_arr, cb) => {
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
              stub = sinon.stub(vm, 'set_current').callsFake((version, cb) => {
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
            stub = sinon.stub(vm, 'set_current').callsFake((version, cb) => { cb() });
          })

          after(function() {
            stub.restore();
          })

          it('advances to stage two', function(done) {
            var async_stub = sinon.stub(async, 'series').callsFake((fx_arr, cb) => {
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
            stub = sinon.stub(prey_user, 'create').callsFake(cb => { cb(new Error('Gave up')) });
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
            stub = sinon.stub(prey_user, 'create').callsFake(cb => { cb() });
          })

          after(function() {
            stub.restore();
          })

          it('advances to stage two', function(done) {
            var async_stub = sinon.stub(async, 'series').callsFake((fx_arr, cb) => {
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
          stage_one_stub = sinon.stub(vm, 'set_current').callsFake((ver, cb) => { cb() });
        } else {
          // if running not on windows, skip create user part
          stage_one_stub = sinon.stub(prey_user, 'create').callsFake(cb => { cb() });
        }
      })

      after(function() {
        stage_one_stub.restore();
      })

      describe('if daemon.install fails', function() {

        before(function() {
          stub = sinon.stub(daemon, 'install').callsFake(cb => { cb(new Error('No daemons around.')) })
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
          stub = sinon.stub(daemon, 'install').callsFake(cb => { cb() })
        })

        after(function() {
          stub.restore();
        })

        describe('and post_install hooks fails', function() {

          var hooks_stub;

          before(function() {
            hooks_stub = sinon.stub(hooks, 'post_install').callsFake(cb => { cb(new Error('Not today')) })
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
          let daemonWatcher;
          let hooks_stub;

          before(function() {
            daemonWatcher = sinon.stub(daemon, 'set_watcher').callsFake(
              cb => { return cb();
            });
            hooks_stub = sinon.stub(hooks, 'post_install').callsFake(cb =>{ return cb() })
          })

          after(function() {
            hooks_stub.restore();
            daemonWatcher.restore();
          })

          it('returns no error', function(done) {
            tasks.post_install({}, function(err) {
              should.not.exist(err);
              done();
            })
          })

        })

      })

      describe('if hooks.post_install fails', function() {
        let hooks_stub;
        before(function() {
          hooks_stub = sinon.stub(hooks, 'post_install').callsFake(cb => { cb() })
        })

        after(function() {
          hooks_stub.restore();
        })

        it('returns EACCESS error', function(done) {
          tasks.post_install({}, function(err) {
            err.should.exist;
            err.code.should.eql('EACCES');
            done();
          })
        })

        it('does not run daemon set_watcher', function(done) {
          var async_spy = sinon.spy(daemon, 'set_watcher');

          tasks.post_install({}, function(err) {
            async_spy.called.should.be.false;
            async_spy.restore();
            done();
          })
        })

      })

      describe('if hooks.post_install works', function() {

        describe('and set watcher succeed', function() {

          var stub, watcher_stub;

          before(function() {
            stub = sinon.stub(daemon, 'install').callsFake(cb => { cb() })
            watcher_stub = sinon.stub(daemon, 'set_watcher').callsFake(cb => { cb() })
          })

          after(function() {
            stub.restore();
            watcher_stub.restore();
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
            stub = sinon.stub(vm, 'list').callsFake(() => { return [] })
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
            stub = sinon.stub(firewall, 'add_rule').callsFake((obj, cb) => {
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
        var keys_get_stub,
            request_stub,
            api_push_spy;

        after(() => {
          api.keys.unset('api');
        })

        describe('when the device is configured', () => {
          before(() => {
            keys_get_stub = sinon.stub(shared.keys, 'get').callsFake(() => {
              return { api: 'aaaaaaaaaaaa', device: 'bbbbbb' }
            });
            request_stub = sinon.stub(request, 'post').callsFake((url, data, opts, cb) => {
              return;
            });
            api_push_spy = sinon.spy(api.push, 'event');
          });

          after(() => {
            keys_get_stub.restore();
            api_push_spy.restore();
            request_stub.restore();
          });

          describe('and is updating', () => {
            it('does not send the event', (done) => {
              tasks.pre_uninstall({'-u': true, positional: [1]}, (err) => {
                api_push_spy.notCalled.should.be.equal(true);
                done();
              });
            })
          });

          describe('when is not updating', () => {
            it('send the event', (done) => {
              tasks.pre_uninstall({}, function(err) {
                api_push_spy.calledOnce.should.be.equal(true);
                done();
              });
            });
          })
        })

        describe('when is not configured is not updating', () => {

          before(() => {
            keys_get_stub = sinon.stub(shared.keys, 'get').callsFake(() => {
              return { api: '', device: '' }
            });
            request_stub = sinon.stub(request, 'post').callsFake((url, data, opts, cb) => {
              return;
            });
            api_push_spy = sinon.spy(api.push, 'event');
          });

          after(() => {
            keys_get_stub.restore();
            api_push_spy.restore();
            request_stub.restore();
          });

          it('doesnt send anything', (done) => {
            api_push_spy.notCalled.should.be.equal(true);
            done();
          })
        })
      })
    })
  })
})
