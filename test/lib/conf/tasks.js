var fs      = require('fs'),
    join    = require('path').join,
    should  = require('should'),
    sinon   = require('sinon'),
    rimraf  = require('rimraf'),
    helpers = require('./../../helpers'),
    tmpdir  = require('os').tmpdir();

var getset  = require('getset');
var common  = require(helpers.lib_path('common'));
var tasks   = require(helpers.lib_path('conf', 'tasks'));
var vm      = require(helpers.lib_path('conf', 'shared', 'version_manager'));

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
                fs.mkdir(version_dir);
                fs.writeFile(version_dir + '/package.json', JSON.stringify({ version: '2.3.4'}), done);
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

  })

  describe('pre_uninstall', function() {

  })

  describe('hooks', function() {

    describe('windows', function() {

      var hooks    = require(helpers.lib_path('conf', 'tasks', 'os', 'windows')),
          firewall = require('firewall');

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
            hooks.post_activate(function(err) {
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
            hooks.post_activate(function(err) {
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
