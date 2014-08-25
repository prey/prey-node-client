var fs      = require('fs'),
    path    = require('path'),
    async   = require('async'),
    satan   = require('satan'),
    sinon   = require('sinon'),
    should  = require('should'),
    tmpdir  = require('os').tmpdir(),
    mkdirp  = require('mkdirp'),
    rimraf  = require('rimraf'),
    sandbox = require('sandboxed-module'),
    helpers = require('./../../../helpers');

var module_path = helpers.lib_path('conf', 'tasks', 'daemon');

var common = require(helpers.lib_path('common'));
var cp     = require(helpers.lib_path('conf', 'utils', 'cp'));

var install_dir = tmpdir + '/daemon-spec';
var current_dir = install_dir + '/current';

describe('installing', function() {

  var spy, stub;

  var run = function(platform, method, cb) {
    var opts = {
      requires: {
        satan: satan,
        '../utils/cp': cp,
        './../../system/paths': {
           current: current_dir,
           install: install_dir
        }
      },
      globals: {
        process: {
          platform: platform
        }
      }
    }

    var module = sandbox.require(module_path, opts);
    module[method](cb);
  }

  var satan_create_stub;

  var stub_create = function(res) {
    satan_create_stub = sinon.stub(satan, 'ensure_created', function(opts, cb) {
      return cb(res);
    })
  }

  var satan_exists_stub;

  var stub_exists = function(bool) {
    satan_exists_stub = sinon.stub(satan, 'exists', function(key, cb) {
      return cb(null, bool);
    })
  }

  describe('on windows', function() {

    var old_process;

    before(function() {
      old_process = process.platform;
      process.platform = 'win32';
    })

    after(function() {
      process.platform = old_process;
    })

    describe('copying service bin', function() {

      var source_bin = current_dir + '/lib/system/windows/bin/wpxsvc.exe';
      var bin_path   = install_dir + '/wpxsvc.exe';

      before(function(done) {
        // create full path. this makes both current and install paths available
        mkdirp(path.dirname(source_bin), function(err) {
          if (err) return done(err);

          fs.writeFile(source_bin, 'source file', done)
        })
      })

      after(function(done) {
        rimraf(install_dir, done);
      })

      describe('with no write access', function() {

        describe('and file not present', function() {

          before(function(done) {
            fs.chmod(install_dir, '500', done);
          })

          after(function(done) {
            fs.chmod(install_dir, '750', done);
          })

          before(function() {
            fs.existsSync(bin_path).should.be.false;
          })

          it('returns an error', function(done) {
            run('win32', 'install', function(err) {
              err.should.exist;
              err.code.should.eql('EACCES');
              done();
            })
          })

          it('does not copy bin', function(done) {
            run('win32', 'install', function(err) {
              fs.existsSync(bin_path).should.be.false;
              done();
            })
          })

        })

        // this is a tricky one. should we just continue if no write access
        // but the binary IS there already?

        // for now, we'll just return an error.

        describe('and file is present', function() {

          before(function(done) {
            fs.writeFile(bin_path, 'Hola que tal', { mode: '500' }, function(err) {
              fs.chmod(install_dir, '500', done);
            });
          })

          after(function(done) {
            fs.chmod(install_dir, '750', function(err) {
              fs.unlink(bin_path, done);
            });
          })

          it('returns an error', function(done) {
            run('win32', 'install', function(err) {
              err.should.exist;
              err.code.should.eql('EACCES');

              // bin should still be there
              fs.existsSync(bin_path).should.be.true;

              done();
            })
          })

/*
          it('calls satan.ensure_created', function(done) {
            stub = sinon.stub(satan, 'ensure_created', function(opts, cb) {
              cb(new Error('satan.ensure_created called'));
            })

            run('win32', 'install', function(err) {
              err.should.exist;
              err.message.should.eql('satan.ensure_created called');
              stub.restore();
              done();
            })
          })
*/

        })

      })

      describe('with write access', function() {

        before(function(done) {
          fs.chmod(install_dir, '750', done);
        })

        describe('and file not present', function() {

          before(function(done) {
            if (fs.existsSync(bin_path))
              fs.unlink(bin_path, done);
            else
              done();
          })

          it('calls satan.ensure_created', function(done) {
            stub = sinon.stub(satan, 'ensure_created', function(opts, cb) {
              cb(new Error('satan.ensure_created called'));
            })

            run('win32', 'install', function(err) {
              err.should.exist;
              err.message.should.eql('satan.ensure_created called');
              stub.restore();
              done();
            })
          })

        })

        describe('and file is present', function() {

          before(function(done) {
            fs.writeFile(bin_path, 'Hola que tal', done);
          })

          after(function(done) {
            fs.unlink(bin_path, done);
          })

          describe('if copy returns a EBUSY error', function() {

            var cp_stub;

            before(function() {
              cp_stub = sinon.stub(cp, 'cp', function(source, dest, cb) {
                var err = new Error('Busy doing something');
                err.code = 'EBUSY';
                cb(err);
              })
            })

            after(function() {
              cp_stub.restore();
            })

            it('continues calls satan.ensure_created', function(done) {
              stub = sinon.stub(satan, 'ensure_created', function(opts, cb) {
                cb(new Error('satan.ensure_created called'));
              })

              run('win32', 'install', function(err) {
                err.should.exist;
                err.message.should.eql('satan.ensure_created called');
                stub.restore();
                done();
              })
            })

          })

          describe('if copy returns no error', function() {

            it('calls satan.ensure_created', function(done) {
              stub = sinon.stub(satan, 'ensure_created', function(opts, cb) {
                cb(new Error('satan.ensure_created called'));
              })

              run('win32', 'install', function(err) {
                err.should.exist;
                err.message.should.eql('satan.ensure_created called');
                stub.restore();
                done();
              })
            })

          })

        })

      })

    })

  })

  describe('if daemon is already installed', function() {

    before(function() {
      stub_exists(true);
    })

    after(function() {
      satan_exists_stub.restore();
    })

    describe('and satan.ensure_create fails', function() {

      before(function() {
        stub_create(new Error('Unable to create.'));
      })

      after(function() {
        satan_create_stub.restore();
      })

      it('returns an error', function(done) {
        run(process.platform, 'install', function(err) {
          err.should.exist;
          err.message.should.eql('Unable to create.');
          done();
        })
      })

      it('does not start the bugger', function(done) {
        var start_spy = sinon.spy(satan, 'start');

        run(process.platform, 'install', function(err) {
          start_spy.called.should.be.false;
          start_spy.restore();
          done();
        })
      })

    })

    describe('and satan.ensure_create succeeds', function() {

      before(function() {
        stub_create(null);
      })

      after(function() {
        satan_create_stub.restore();
      })

      it('starts the little bugger', function(done) {
        var start_stub = sinon.stub(satan, 'start', function(key, cb) {
          cb(new Error('satan.start called'));
        });

        run(process.platform, 'install', function(err) {
          err.should.exist;
          err.message.should.eql('satan.start called');
          start_stub.restore();
          done();
        })
      })

    })

  })

  describe('if daemon is not installed', function() {

    before(function() {
      stub_exists(false);
    })

    after(function() {
      satan_exists_stub.restore();
    })

    describe('and creation fails', function() {

      before(function() {
        stub_create(new Error('Unable to create.'));
      })

      after(function() {
        satan_create_stub.restore();
      })

      it('returns an error', function(done) {
        run(process.platform, 'install', function(err) {
          err.should.exist;
          err.message.should.eql('Unable to create.');
          done();
        })
      })

      it('does not start the bugger', function(done) {
        var start_spy = sinon.spy(satan, 'start');

        run(process.platform, 'install', function(err) {
          start_spy.called.should.be.false;
          start_spy.restore();
          done();
        })
      })

    })

    describe('and creation succeeds', function() {

      before(function() {
        stub_create(null);
      })

      after(function() {
        satan_create_stub.restore();
      })

      it('starts the little bugger', function(done) {
        var start_stub = sinon.stub(satan, 'start', function(key, cb) {
          cb(new Error('satan.start called'));
        });

        run(process.platform, 'install', function(err) {
          err.should.exist;
          err.message.should.eql('satan.start called');
          start_stub.restore();
          done();
        })
      })

    })

  })

  describe('when starting process', function() {

    var start_stub;

    before(function() {
      stub_create(null); // assume create works ok.
    })

    after(function() {
      satan_create_stub.restore();
    })

    describe('if able to', function() {

      before(function() {
        start_stub = sinon.stub(satan, 'start', function(key, cb) {
          cb();
        });
      })

      after(function() {
        start_stub.restore();
      })

      it('returns no error', function(done) {
        run(process.platform, 'install', function(err) {
          should.not.exist(err);
          done();
        })
      })

    })

    describe('if unable to', function() {

      before(function() {
        start_stub = sinon.stub(satan, 'start', function(key, cb) {
          cb(new Error('Unable to start process.'));
        });
      })

      after(function() {
        start_stub.restore();
      })

      it('returns error', function(done) {
        run(process.platform, 'install', function(err) {
          err.should.exist;
          err.message.should.eql('Unable to start process.');
          done();
        })
      })

    })

  })

})
