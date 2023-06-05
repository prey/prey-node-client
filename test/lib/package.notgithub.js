var fs            = require('fs'),
    join          = require('path').join,
    basename      = require('path').basename,
    needle        = require('needle'),
    remove        = require('remover'),
    os            = require('os'),
    tmp           = require('os').tmpdir,
    sinon         = require('sinon'),
    should        = require('should'),
    rmdir         = require('rimraf'),
    buckle        = require('buckle'),
    needle        = require('needle'),
    child_process = require('child_process'),
    helpers       = require('../helpers'),
    shared        = require(helpers.lib_path('conf', 'shared')),
    api           = require(helpers.lib_path('agent', 'plugins', 'control-panel', 'api')),
    common        = require(helpers.lib_path('common')),
    storage       = require(helpers.lib_path('agent', 'utils', 'storage'));

var package       = require(helpers.lib_path('package'));

var is_windows    = process.platform === 'win32';
var tmpdir        = is_windows ? process.env.WINDIR + '\\Temp' : '/tmp';

var dummy_version = '1.5.0';
var dummy_zip     = join(__dirname, 'conf', 'fixtures', 'prey-' + dummy_version + '.zip');
var dummy_checksum = '1cb6c1b14888d1d88021689b5971a25dfb3a132a';

var current_checksum;

//////////////////////////////////////////////////////
helpers

var get_file_name = function(ver) {
  var os_name   = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
      arch      = process.arch == 'x64' ? 'x64' : 'x86';
  return ['prey', os_name, ver, arch].join('-') + '.zip';
}

var stable_version = function(ver) {
  var fn = function(url, opts, cb) {
    if (typeof opts == 'function') {
      cb = opts;
      opts = {};
    }

    function resp(err, body, code) {
      cb(null, { statusCode: code || 200, body: body }, body);
    }

    if (url.match('latest.txt')) {
      resp(null, '1.2.3');
    } else {
      resp(new Error('GET ' + url));
    }
  };

  return sinon.stub(needle, 'get').callsFake(fn);
}

var emulate_download = function(file) {
  var requested_file = null;

  var fn = function(url, opts, cb) {

    if (!opts.output) {
      var obj = {};
      obj[requested_file] = current_checksum || 'c.h.e.c.k.s.u.m';
      return cb(null, { body: obj });
    }

    requested_file = basename(url); //store it for later

    fs.readFile(file, function(err, data) {
      fs.writeFile(opts.output, data, function(err) {
        cb(null, { statusCode: 200 });
      });
    })
  }

  return sinon.stub(needle, 'get').callsFake(fn);
}

var stub_unpacker = function(fn) {

  if (!fn) fn = (cmd, opts, cb) => { cb(new Error('Unpack called!')) };
  if (process.platform == 'darwin')
    return sinon.stub(child_process, 'exec').callsFake(fn);
  else
    return sinon.stub(buckle, 'open').callsFake(fn);
}

//////////////////////////////////////////////////////

describe('package.get_latest', function() {

  before(function() {
    process.stdout.writable = false; //turns logging off for this module
  })

  after(function() {
    process.stdout.writable = true; //logging back on
  })

  function get_latest(current_version, dest, cb) {
    package.get_latest('stable', current_version, dest, cb);
  }

  it('checks if a new version is available', function (done) {
    var spy = sinon.spy(needle, 'get');

    var cut = sinon.stub(package, 'get_version').callsFake((ver, dest, cb) => {
      cb(new Error('Stopping here.'))
    })

    package.get_latest('stable', '1.2.3', '/tmp', function(err, ver) {
      spy.restore();
      cut.restore();
      err.message.should.eql('Stopping here.');
      spy.args[0][0].should.eql("https://downloads.preyproject.com/prey-client-releases/node-client/latest.txt");
      spy.calledOnce.should.be.true;
      done();
    });
  });

  describe('when no new version is available', function() {

    var stub, down;

    before(function() {
      stub = stable_version('1.2.3');
    })

    after(function() {
      stub.restore();
    })

    it('does not download anything', function (done) {
      get_latest('1.2.3', tmpdir, function (err, new_ver) {
        stub.callCount.should.eql(1);
        done();
      });
    });

    it('returns an error', function(done) {
      get_latest('1.2.3', tmpdir, function (err, new_ver) {
        err.message.should.equal('Already running latest version.');
        should.not.exist(new_ver);
        done();
      });
    })

  });

  describe('when a new version is available', function() {

    var stub, device_stub, event_stub, event_data_stub, attempts_stub, shared_keys_stub;
    var new_version = '1.5.0', old_ver = '1.2.3';

    before(function (done) {
      common.version = old_ver;
      stub = sinon.stub(package, 'new_version_available').callsFake((branch, current_version, cb) => {
        cb(null, new_version);
      })
      var update_data = {
        location: {
          lat: -33,
          lon: -77
        },
        ip: "000.00.00.000",
        country: "US"
      }
      event_stub = sinon.stub(api.push, 'event').callsFake((keys, cb) => { return cb(); });
      device_stub = sinon.stub(shared.keys, 'verify_current').callsFake((cb) => { return cb(); });
      event_data_stub = sinon.stub(package, 'get_update_data').callsFake((cb) => { return cb(update_data); });
      post_event_stub = sinon.spy(package, 'post_event');

      post_spy = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
        return cb();
      });

      storage.init('versions', tmp() + '/versions.db', done);
    });

    after(function(done) {
      stub.restore();
      device_stub.restore();
      event_stub.restore();
      event_data_stub.restore();
      post_spy.restore();
      post_event_stub.restore();
      storage.erase(tmp() + '/versions.db', done)
    });

    it('requests the package and create version registry', function (done) {
      var file_name = get_file_name(new_version),
          url       = 'https://downloads.preyproject.com/prey-client-releases/node-client/' + new_version + '/' + file_name,
          outfile   = join(tmpdir, file_name);

      var getter    = sinon.stub(needle, 'get').callsFake((requested_url, opts, cb) => {
        requested_url.should.equal(url);
        opts.output.should.equal(outfile);
        getter.restore();
        storage.do('all', {type: 'versions'}, function(err, out) {
          should.not.exist(err);
          out.length.should.be.equal(1);
          out[0].id.should.be.equal('1.5.0');
          out[0].from.should.be.equal('1.2.3');
          out[0].to.should.be.equal('1.5.0');
          out[0].attempts.should.be.equal(1);
          out[0].notified.should.be.equal(0);
          post_event_stub.notCalled.should.equal(true);
          done();
        })
      });

      fs.unlink(outfile, function() {
        get_latest('1.2.3', tmpdir, function(err) { /* noop */ });
      });
    });

    describe('and the download fails', function() {

      var fail_down;

      before(function() {
        fail_down = sinon.stub(needle, 'get').callsFake((url, opts, cb) => {
          cb(new Error('Unable to download because I dont feel like it.'))
        })
      })

      after(function() {
        fail_down.restore();
      })

      it('returns an error', function(done) {

        get_latest('1.2.3', tmpdir, function(err) {
          storage.do('all', {type: 'versions'}, function(err1, out) {
            post_event_stub.calledOnce.should.equal(true)
            should.not.exist(err1);
            out[0].attempts.should.be.equal(2);
            out[0].notified.should.be.equal(0);
            err.should.be.a.Error;
            err.message.should.match('Unable to download because I dont feel like it.');
            done();
          })
        });

      })

      it('does not verify checksum of anything', function(done) {

        var spy = sinon.spy(fs, 'createReadStream');

        get_latest('1.2.3', tmpdir, function(err) {
          storage.do('all', {type: 'versions'}, function(err, out) {
            post_event_stub.calledTwice.should.equal(true);
            should.not.exist(err);
            
            out[0].attempts.should.be.equal(3);
            out[0].notified.should.be.equal(0);
          })
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

        var spy = sinon.spy(fs, 'createReadStream');

        get_latest('1.2.3', tmpdir, function(err) {
          spy.called.should.be.true;
          spy.args[0][0].should.match(/prey-(\w+)-1.5.0-(\w+).zip/);
          spy.restore();
          spystub.calledWith.should.be('foobar');
          done()
        });

      })

      describe('and the checksum is invalid', function() {

        //just keep the checksum as it is

        it('returns an error', function(done) {

          get_latest('1.2.3', tmpdir, function(err) {
            err.should.be.a.Error;
            err.message.should.containEql('Invalid checksum');
            done()
          });

        })

        it('does not try to install it', function(done) {

          var spy = sinon.spy(package, 'install');

          get_latest('1.2.3', tmpdir, function(err) {
            spy.called.should.be.false;
            spy.restore();
            done();
          });

        })

        it('removes the package', function(done) {

          var file = get_file_name(new_version);
          var dest = join(tmpdir, file)

          get_latest('1.2.3', tmpdir, function(err) {
            fs.existsSync(dest).should.be.false;
            done();
          })

        })

      })

      describe('and the checksum is valid', function() {

        before(function() {
          current_checksum = dummy_checksum;
        })

        //no write perms only testable in *Nix and Windows > XP
        if (!is_windows || parseFloat(os.release()) > 5.1) {

        describe('with no write permissions', function() {

          var dest = is_windows ? 'C:\\Windows\\System32\\' : '/';

          it('does not create folder', function(done) {
            get_latest('1.2.3', dest, function(err, res) {
              should.exist(err);
              err.message.match(/Permission denied/g);
              var exists = fs.existsSync(join(dest, new_version))
              exists.should.be.equal(false);
              done();
            })
          })

          it('does not removes downloaded package', function (done) {

            var file_name = get_file_name(new_version);
            var out       = join(tmpdir, file_name);

            get_latest('1.2.3', dest, function (err) {
              should.exist(err);
              err.message.match(/Permission denied/g);
              var exists = fs.existsSync(out);
              exists.should.be.equal(true);
              done();
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

          it('tries to unzip the package to requested path', function(done) {
            var spy = stub_unpacker();

            get_latest('1.2.3', dest, function(err) {
              spy.calledOnce.should.be.true;
              spy.restore();
              done()
            });

          });

          it('removes downloaded package', function (done) {
            var file_name = get_file_name(new_version);
            var out       = join(tmpdir, file_name);

            get_latest('1.2.3', dest, function (err) {
              fs.existsSync(out).should.be.false;
              done();
            });
          });

          describe('if unpacking fails', function() {

            var failer;

            before(function() {
              failer = stub_unpacker(); //default function returns error already
            })

            after(function() {
              failer.restore();
            })

            it('does not try to rename', function(done) {
              var spy = sinon.spy(fs, 'rename'); 

              get_latest('1.2.3', dest, function(err) {
                err.message.should.eql('Unpack called!');
                spy.called.should.be.false;
                spy.restore();
                done();
              });

            })

          })

          describe('if unpacking works', function() {

            //no need to stub, should work by default

            it('tries to rename the folder from prey-a.b.c to simply a.b.c', function(done) {

              var spy = sinon.spy(fs, 'rename'); 

              get_latest('1.2.3', dest, function(err) {
                spy.called.should.be.true;
                spy.args[0][0].should.eql(join(dest, 'prey-' + new_version));
                spy.args[0][1].should.eql(join(dest, new_version));
                spy.restore();
                done();
              });

            })

            describe('if renaming fails', function() {

              var failer;

              before(function() {
                failer = sinon.stub(fs, 'rename').callsFake((from, to, cb) => {

                  fs.mkdirSync(to);
                  fs.writeFileSync(join(to, 'package.json'), 'just testing');

                  cb(new Error('I dont feel like finishing right now.'))
                })
              })

              after(function() {
                failer.restore();
              })

              it('ensures the destination folder is removed', function(done) {

                get_latest('1.2.3', dest, function(err) {
                  err.message.should.eql('I dont feel like finishing right now.');

                  fs.existsSync(join(dest, new_version)).should.be.false;
                  fs.existsSync(join(dest, new_version, 'package.json')).should.be.false;

                  done();
                });
              })

            })

            describe('if renaming works', function() {

              //nothing to stub, it should work by default

              it('final folder should exist', function(done) {
                get_latest('1.2.3', dest, function(err) {
                  should.not.exist(err);

                  fs.existsSync(join(dest, new_version)).should.be.true;
                  done()
                });
              });

              if (!is_windows) {

                it('makes sure bin/node and bin/prey are executable', function(done) {
                  get_latest('1.2.3', dest, function(err) {
                    fs.statSync(join(dest, new_version, 'bin', 'prey')).mode.should.equal(33261);
                    fs.statSync(join(dest, new_version, 'bin', 'node')).mode.should.equal(33261);
                    done()
                  });
                });

              }

            })

          })

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

describe('on successful update', function() {

  function delete_older_versions(old_ver, new_ver, versions_path) {
    package.delete_older_versions(old_ver, new_ver, versions_path);
  }

  describe('when new version data exists', function() {

    var dirs = ['1.3.5', '1.4.2', '1.4.8', '1.5.0' ];
    before(function(done) {
      fs.mkdir(join(tmpdir, 'versions'), function() {
        dirs.forEach(function(version) {
          fs.mkdirSync(join(tmpdir, 'versions', version));
        })
        done();
      })
    })

    after(function(done) {
      remove(join(tmpdir, 'versions'), done);
    })

    it('deletes older versions', function(done) {
      delete_older_versions('1.4.8', dummy_version, join(tmpdir, 'versions'));

      setTimeout(function() {
        fs.readdir(join(tmpdir, 'versions'), function(err, versions) {
          versions.length.should.be.equal(2);
          versions[0].should.be.equal('1.4.8');
          versions[1].should.be.equal('1.5.0');
          done();
        })
      }, 20)
    })
  })

  describe('when new version data does not exists or does not have version format', function() {
    var dirs = ['1.3.5', '1.4.2', '1.4.8', '1.5.0' ];

    before(function(done) {
      fs.mkdir(join(tmpdir, 'versions'), function() {
        dirs.forEach(function(version) {
          fs.mkdirSync(join(tmpdir, 'versions', version));
        })
        done();
      })
    })

    after(function(done) {
      remove(join(tmpdir, 'versions'), done);
    })

    it('does not delete older versions', function(done) {
      delete_older_versions('1.4.8', 'no-version-format', join(tmpdir, 'versions'));

      setTimeout(function() {
        fs.readdir(join(tmpdir, 'versions'), function(err, versions) {
          versions.length.should.be.equal(4);
          done();
        })
      }, 20)
    })
  })
});
