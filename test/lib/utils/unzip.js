var fs                = require('fs'),
    join              = require('path').join,
    should            = require('should'),
    helpers           = require(join('..', '..', 'helpers')),
    unzip             = require(helpers.lib_path('utils', 'unzip')),
    rmdir             = require(helpers.lib_path('utils', 'rmdir'));

var is_windows        = process.platform === 'win32',
    tmpdir            = require('os').tmpDir(),
    valid_zip_path    = join(__dirname, '..', '..', 'utils', 'valid_zip_file.zip'),
    invalid_zip_path  = join(tmpdir, '18fpic9501e85c73505139071209e5333fb.zip');

describe('lib/utils/unzip', function (){

  describe('when an unvalid zip file is given', function (){

    before(function(done){
      fs.writeFile(invalid_zip_path, '..................', done);
    });

    after(function(done){
      fs.unlink(invalid_zip_path, done);
    });

    it('unzip will callback with an error', function (done){
      unzip(invalid_zip_path, tmpdir, function(err){
        should.exist(err);
        done();
      });
    });

  });

  describe('when a valid zip file is given', function (){

    describe('and it haves write permissions', function (){

      it('expands it in the destination directory', function (done){
        unzip(valid_zip_path, tmpdir, function(err) {
          should.not.exist(err);
          fs.readFileSync(tmpdir + '/aaa/aaa.txt', 'utf8').should.match(/AAA/);
          fs.readFileSync(tmpdir + '/aaa/bbb/bbb.txt', 'utf8').should.match(/BBB/);
          fs.readFileSync(tmpdir + '/aaa/bbb/ccc/ccc.txt', 'utf8').should.match(/CCC/);
          done();
        })
      });

      after(function(done){
        rmdir(join(tmpdir, 'aaa'), done);
      });

    });

    describe('and it doesn\'t have write permissions', function (){

      var test_no_perms_path = tmpdir + '/test_no_perms';

      before(function(done) {
        fs.mkdir(test_no_perms_path, function(err) {
          fs.chmod(test_no_perms_path, 0400, done);
        });
      });

      after(function(done){
        fs.rmdir(test_no_perms_path, done);
      });

      it('unzip will callback with an EACCES error', function(done) {

        unzip(valid_zip_path, test_no_perms_path, function(err) {
          err.code.should.equal('EACCES');
          done();
        });

      });

    });

  });

});
