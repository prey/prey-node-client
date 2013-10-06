
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

var stub_get_file = function(file) {
  var fn = function(url, opts, cb) {
    fs.readFile(file, function(err, data){
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

  before(function(){
    process.stdout.writable = false; // turns logging off for this module
  })

  after(function(){
    process.stdout.writable = true; // logging back on
  })

  it('checks if a new version is available', function (done){
    var spy = sinon.spy(needle, 'get');

    package.get_upstream_version(function(err, ver){
      should.not.exist(err);
      ver.should.match(/\d\.\d\.\d/);
      spy.calledOnce.should.be.true;
      spy.restore();
      done();
    });
  });

  describe('when no new version is available', function(){

    it('does not download anything', function (done){
      var stub = upstream_version('1.2.3');
      package.get_latest('1.2.3', null, function (err){
        err.message.should.equal('Already running latest version.');
        stub.restore();
        done();
      });
    });

  });

  describe('when a new version is available', function(){

    var stub, new_version = '1.5.0';

    before(function (){
      stub = upstream_version(new_version);
    });

    after(function(){
      stub.restore();
    })

    it('requests the package', function (done){
      var file_name = get_file_name(new_version),
          url       = 'http://s3.amazonaws.com/prey-releases/node-client/' + new_version + '/' + file_name,
          outfile   = join(tmpdir, file_name);

      var getter    = sinon.stub(needle, 'get', function(requested_url, opts, cb){
        requested_url.should.equal(url);
        opts.output.should.equal(outfile)
        getter.restore()
        done()
      });

      package.get_latest('1.2.3', tmpdir, function(err) {
        // noop
      });
    });

    it('downloads the package', function(done){
      var getter = stub_get_file(dummy_zip);

      // install is called after download, so when called, the package should have been downloaded
      var inst = sinon.stub(package, 'install', function(zip, dest, cb){
        fs.exists(zip, function(exists){
          exists.should.be.true;
          inst.restore();
          getter.restore();
          done();
        })
      })
      package.get_latest('1.2.3', '/wherever', function() {
        // noop
      });
    })

    describe('with no write permissions', function(){
      var getter, dest;

      before(function(){
        getter = stub_get_file(dummy_zip);
        dest = is_windows ? 'C:\\Windows\\System32\\' : '/';
      })

      after(function(){
        getter.restore();
      })

      it('does not create folder', function(done) {
        package.get_latest('1.2.3', dest, function(err){
          should.exist(err);
          err.code.should.match(/(EACCES|EPERM)/);
          fs.exists(join(dest, new_version), function(exists){
            exists.should.be.false;
            done();
          })
        })
      })

      it('removes downloaded package', function (done){
        var file_name = get_file_name(new_version);
        var out       = join(tmpdir, file_name);

        package.get_latest('1.2.3', dest, function (err){
          should.exist(err);
          err.code.should.match(/(EACCES|EPERM)/);
          fs.exists(out, function(exists){
            exists.should.be.false;
            done();
          })
        });
      });

    });

    describe('with write permissions', function(){

      var getter, dest;

      before(function(){
        getter = stub_get_file(dummy_zip);
        dest = join(tmpdir, 'versions');
      })

      after(function(){
        getter.restore();
      })

      beforeEach(function(done){
        fs.mkdir(dest, done);
      })

      afterEach(function(done){
        rmdir(dest, done);
      })

      it('unzips the package to requested path', function(done){
        package.get_latest('1.2.3', dest, function(err){
          should.not.exist(err);
          fs.existsSync(join(dest, new_version)).should.be.true;
          done()
        })
      });

      // this test probably passes only in *nixes
      if (!is_windows) {
      it('makes sure bin/node and bin/prey are executable', function(done){
        package.get_latest('1.2.3', dest, function(err){
          fs.statSync(join(dest, new_version, 'bin', 'prey')).mode.should.equal(33261);
          fs.statSync(join(dest, new_version, 'bin', 'node')).mode.should.equal(33261);
          done()
        });
      });
      }

      it('removes downloaded package', function (done){
        var file_name = get_file_name(new_version);
        var out       = join(tmpdir, file_name);

        package.get_latest('1.2.3', dest, function (err){
          should.not.exist(err);
          fs.existsSync(out).should.be.false;
          done();
        });
      });

    });
  });

/*
  describe('on successful update', function() {
    describe('when default config has no modified keys', function(){
      it('leaves the file untouched');
    });
    describe('when default config file was modified', function(){
      it('adds new keys');
      it('does not replace any existing values');
    });
  });
*/
})
