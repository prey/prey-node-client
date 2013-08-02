var fs                = require('fs'),
    join              = require('path').join,
    should            = require('should'),
    exec              = require('child_process').exec,
    unzip             = require(join(__dirname, '..', '..', '..', 'lib', 'utils', 'unzip'));

var is_windows        = process.platform === 'win32';
    tmpdir            = is_windows ? os.tmpDir() : '/tmp',
    valid_zip_path    = join(__dirname, '..', '..', 'utils', 'valid_zip_file.zip'),
    unvalid_zip_path  = join(tmpdir, '18fpic9501e85c73505139071209e5333fb.zip');

describe('lib/utils/unzip', function (){

  describe('when an unvalid zip file is given', function (){

    before(function(done){
      fs.writeFile(unvalid_zip_path, '..................', done);
    });

    it('unzip will callback with an error', function (done){
      unzip(unvalid_zip_path, tmpdir, function(err){
        should.exist(err);
        done();
      });
    });

    after(function(done){
      fs.unlink(unvalid_zip_path, done);
    });
  });

  describe('when a valid zip file is given', function (){

    describe('and it haves write permissions', function (){

      it('uncompress it in the right destiny directory', function (done){
        unzip(valid_zip_path, tmpdir, function (err){
          should.not.exists(err);
          fs.readFileSync(tmpdir + '/aaa/aaa.txt', 'utf8').should.match(/AAA/);
          fs.readFileSync(tmpdir + '/aaa/bbb/bbb.txt', 'utf8').should.match(/BBB/);
          fs.readFileSync(tmpdir + '/aaa/bbb/ccc/ccc.txt', 'utf8').should.match(/CCC/);
          done();
        })
      });

      after(function (done){
        // Delete the files, if they exist
        rmdir(join(tmpdir, 'aaa'));
      });
    });

    describe('and it doesn\'t have write permissions', function (){

      var test_no_perms_path = tmpdir + '/test_no_perms';

      before(function (done){
        fs.mkdir(test_no_perms_path, function (err){
          fs.chmod(test_no_perms_path, 0400, done);
        });
      });

      it('unzip will callback with an EACCES error', function (done){
        unzip(valid_zip_path, test_no_perms_path, function (err){
          err.code.should.equal('EACCES');
          done();
        });
      });

      after(function (done){
        fs.rmdir(test_no_perms_path, done);
      });
    });

  });

});
