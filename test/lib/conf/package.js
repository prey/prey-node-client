var fs            = require('fs'),
    join          = require('path').join,
    needle        = require('needle'),
    os            = require('os'),
    sinon         = require('sinon'),
    should        = require('should'),
    package       = require(join(__dirname, '..', '..', '..', 'lib', 'package')),
    rmdir         = require(join(__dirname, '..', '..', '..', 'lib', 'utils', 'rmdir')),
    unzip_path    = join(__dirname, '..', '..', '..', 'lib', 'utils', 'unzip');

var is_windows    = process.platform === 'win32';
var tmpdir        = is_windows ? process.env.WINDIR + '\\Temp' : '/tmp';

var dummy_version = '1.5.0';
var dummy_zip     = join(__dirname, 'fixtures', 'prey-' + dummy_version + '.zip');

//////////////////////////////////////////////////////
// helpers

var get_file_name = function(ver) {
  var os_name   = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
      arch      = process.arch == 'x64' ? 'x64' : 'x86';
  return ['prey', os_name, ver, arch].join('-') + '.zip';
}

var upstream_version = function(ver) {
  var fn = function(cb) { cb(null, ver) }
  return sinon.stub(package, 'get_upstream_version', fn);
}

var emulate_download = function(file) {
  var fn = function(url, opts, cb) {
    if (!opts.output)
      return cb(null, { body: { 'filename': 'checksum' } });

    fs.readFile(file, function(err, data) {
      fs.writeFile(opts.output, data, function(err) {
        cb(null, { statusCode: 200 });
      });
    })
  }
  return sinon.stub(needle, 'get', fn)
}

//////////////////////////////////////////////////////
// go

describe('config upgrade', function() {

  before(function() {
    process.stdout.writable = false; // turns logging off for this module
  })

  after(function() {
    process.stdout.writable = true; // logging back on
  })

  it('checks if a new version is available', function (done) {
    var spy = sinon.spy(needle, 'get');

    package.get_upstream_version(function(err, ver) {
      spy.restore();
      should.not.exist(err);
      ver.should.match(/\d\.\d\.\d/);
      spy.calledOnce.should.be.true;
      done();
    });
  });

  describe('when no new version is available', function() {

    var stub, down;

    before(function() {
      stub = upstream_version('1.2.3');
      down = sinon.spy(package, 'download_release');
    })

    after(function() {
      stub.restore();
      down.restore();
    })

    it('does not download anything', function (done) {
      package.get_latest('1.2.3', tmpdir, function (err, new_ver) {
        down.called.should.be.false;
        done();
      });
    });

    it('returns an error', function(done) {
      package.get_latest('1.2.3', tmpdir, function (err, new_ver) {
        err.message.should.equal('Already running latest version.');
        should.not.exist(new_ver);
        done();
      });
    })

  });

  describe('when a new version is available', function() {

    var stub, new_version = '1.5.0';

    before(function () {
      stub = upstream_version(new_version);
    });

    after(function() {
      stub.restore();
    })

    it('requests the package', function (done) {
      var file_name = get_file_name(new_version),
          url       = 'https://s3.amazonaws.com/prey-releases/node-client/' + new_version + '/' + file_name,
          outfile   = join(tmpdir, file_name);

      var getter    = sinon.stub(needle, 'get', function(requested_url, opts, cb) {
        requested_url.should.equal(url);
        opts.output.should.equal(outfile);
        getter.restore();
        done()
      });

      package.get_latest('1.2.3', tmpdir, function(err) { /* noop */ });
    });

    describe('and the download fails', function() {

      var fail_down;

      before(function() {
        fail_down = sinon.stub(needle, 'get', function(url, opts, cb) {
          cb(new Error('Unable to download because I dont feel like it.'))
        })
      })

      after(function() {
        fail_down.restore();
      })

      it('returns an error', function(done) {

        package.get_latest('1.2.3', tmpdir, function(err) {
          err.should.be.a.Error;
          err.message.should.match('Unable to download because I dont feel like it.');
          done()
        });

      })

      it('does not verify checksum of anything', function(done) {

        var spy = sinon.spy(package, 'verify_checksum');

        package.get_latest('1.2.3', tmpdir, function(err) {
          spy.called.should.be.false;
          spy.restore();
          done()
        });

      })

    })

    describe('and the download succeeds', function() {

      var down_ok;

      before(function() {
        down_ok = emulate_download(dummy_zip);
      })

      after(function() {
        down_ok.restore();
      })

      it('verifies the checksum', function(done) {

        var spystub = sinon.spy(package, 'verify_checksum');

        package.get_latest('1.2.3', tmpdir, function(err) {
          spystub.restore();
          // spystub.called.should.be.true;
          // spystub.calledWith.should.be('foobar');
          done()
        });

      })

      describe('and the checksum is invalid', function() {

        var checksum_stub;

        before(function() {
          checksum_stub = sinon.stub(package, 'verify_checksum', function(version, release, file, cb) {
            cb(new Error('Unable to retrieve checksums'));
          })
        })

        after(function() {
          checksum_stub.restore();
        })

        it('returns an error', function(done) {

          package.get_latest('1.2.3', tmpdir, function(err) {
            err.should.be.a.Error;
            err.message.should.match('Unable to retrieve checksums');
            done()
          });

        })

        it('does not try to install it', function(done) {

          var spy = sinon.spy(package, 'install');

          package.get_latest('1.2.3', tmpdir, function(err) {
            spy.called.should.be.false;
            spy.restore();
            done();
          });

        })

        it('removes the package', function(done) {

          var file = get_file_name(new_version);
          var dest = join(tmpdir, file)

          package.get_latest('1.2.3', tmpdir, function(err) {
            fs.existsSync(dest).should.be.false;
            done();
          })

        })

      })

      describe('and the checksum is valid', function() {

        var checksum_stub;

        before(function() {
          checksum_stub = sinon.stub(package, 'verify_checksum', function(version, release, file, cb) {
            cb(null, true);
          })
        })

        after(function() {
          checksum_stub.restore();
        })

        // no write perms only testable in *Nix and Windows > XP
        if (!is_windows || parseFloat(os.release()) > 5.1) {

        describe('with no write permissions', function() {

          var dest = is_windows ? 'C:\\Windows\\System32\\' : '/';

          it('does not create folder', function(done) {
            package.get_latest('1.2.3', dest, function(err) {
              should.exist(err);
              err.code.should.match(/(EACCES|EPERM)/);
              fs.exists(join(dest, new_version), function(exists) {
                exists.should.be.false;
                done();
              })
            })
          })

          it('removes downloaded package', function (done) {

            var file_name = get_file_name(new_version);
            var out       = join(tmpdir, file_name);

            package.get_latest('1.2.3', dest, function (err) {
              should.exist(err);
              err.code.should.match(/(EACCES|EPERM)/);
              fs.exists(out, function(exists) {
                exists.should.be.false;
                done();
              })
            });
          });

        });

        }

        describe('with write permissions', function() {

          var dest = join(tmpdir, 'versions');

          beforeEach(function(done) {
            fs.mkdir(dest, done);
          })

          afterEach(function(done) {
            rmdir(dest, done);
          })

          it('unzips the package to requested path', function(done) {
            package.get_latest('1.2.3', dest, function(err) {
              should.not.exist(err);
              fs.existsSync(join(dest, new_version)).should.be.true;
              done()
            })
          });

          // this test probably passes only in *nixes
          if (!is_windows) {
            it('makes sure bin/node and bin/prey are executable', function(done) {
              package.get_latest('1.2.3', dest, function(err) {
                fs.statSync(join(dest, new_version, 'bin', 'prey')).mode.should.equal(33261);
                fs.statSync(join(dest, new_version, 'bin', 'node')).mode.should.equal(33261);
                done()
              });
            });
          }

          it('removes downloaded package', function (done) {
            var file_name = get_file_name(new_version);
            var out       = join(tmpdir, file_name);

            package.get_latest('1.2.3', dest, function (err) {
              should.not.exist(err);
              fs.existsSync(out).should.be.false;
              done();
            });

          });

        });

      });

    });

  });

/*
  describe('on successful update', function() {
    describe('when default config has no modified keys', function() {
      it('leaves the file untouched');
    });
    describe('when default config file was modified', function() {
      it('adds new keys');
      it('does not replace any existing values');
    });
  });
*/

})
