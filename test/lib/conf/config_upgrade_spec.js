
var join      = require('path').join,
    needle    = require('needle'),
    sinon     = require('sinon'),
    package   = require(join(__dirname, '..', '..', '..', 'lib', 'conf', 'package'));

describe('config upgrade', function() {
  var get,
      needle_get_call_url = '';

  before(function (){
    get = sinon.stub(needle, 'get',
            function (url, options, cb){
              needle_get_call_url = url;
              if (!cb) {
                var cb = options;
                return cb(null, '', '0.0.0');
              } else {
                var resp = { statusCode : 200 };
                return cb(null, resp, 'OLA KE ASE');
              }
            });
    process.stdout.writable = false;
  });

  it('checks if a new version is available', function (done){
    package.check_latest_version(function(err, ver){
      ver.should.be.equal('0.0.0');
      done();
    });
  });

  after(function (){
    process.stdout.writable = true;
    get.restore();
  });

  describe('when no new version is available', function(){

    before(function (){
      checker = sinon.stub(package, 'check_latest_version',
                  function (cb) {
                    cb(null, '1.2.3');
                  });
    });

    it('does not download anything', function (done){
      package.get_latest('1.2.3', null, function (err){
        err.message.should.be.equal('Already running latest version: 1.2.3')
        done();
      });
    });

    after(function (){
      checker.restore();
    });
  });

  describe('when a new version is available', function(){

    before(function (){
      checker   = sinon.stub(package, 'check_latest_version',
                    function (cb) {
                      cb(null, '0.0.0');
                    });
      installer = sinon.stub(package, 'install',
                    function (zip, dest, cb) {
                      cb(null, '0.0.0');
                    });
    });

    it('downloads the package', function (done){
      package.get_latest('1.2.3', '/', function (){
        needle_get_call_url.match(/http:\/\/s3.amazonaws.com\/prey-releases\/node-client\/0.0.0\/prey-(mac|win|linux)-0.0.0-(x64|x86).zip/);
        done();
      });
    });

    after(function (){
      checker.restore();
      installer.restore();
    });

    describe('with no write permissions', function(){

      it('removes downloaded package');
      // it('notifies of error')
      it('exits with status code 1');
    });

    describe('with write permissions', function(){

      it('unzips the package to versions path');
      it('runs config activate on new package');
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
