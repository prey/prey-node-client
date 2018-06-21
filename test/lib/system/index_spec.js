var join        = require('path').join,
    should      = require('should'),
    sinon       = require('sinon'),
    helpers     = require('../../helpers'),
    is_windows  = process.platform === 'win32';

describe('system functions', function() {

  var index = require(helpers.lib_path('system'));

  describe('get_logged_user()', function() {

    describe('when there is no logged user', function() {
      it('returns an error');
    })

    describe('when there IS a logged user', function() {

      it('returns his username', function(done){
        index.get_logged_user(function(err, user){
          should.not.exist(err);
          should.exist(user);
          user.should.not.be.equal('');
          done();
        });
      });

    })

  });

  describe('tempfile_path()', function() {

    it('requires a filename')
    it('returns the full filename path')
    it('does not return a personal temp folder in the path')

  });

  describe('get_running_user()', function() {

    it('gets a value for the running user', function() {
      var user = index.get_running_user();
      user.length.should.be.above(0);
    });
  });

  describe('get_os_info() -> get_os_version + get_os_name', function() {

    it('returns properties [name, version, arch]', function(done){
      index.get_os_info(function(err, response){
        response.should.have.keys('name', 'version', 'arch');
        response.name.should.exist;
        done();
      })
    });
  });

  describe('get_os_name', function() {

    it('does not fail', function(done) {
      index.get_os_name(function(err, name) {
        should.not.exist(err);
        name.should.be.a.String;
        done();
      });
    });

  });

  describe('get_os_version', function() {

    it('does not fail', function(done) {
      index.get_os_version(function(err, version) {
        should.not.exist(err);
        version.should.be.a.String;
        done();
      });
    });

  });

  describe('process_running()', function() {

    it('should proxy to os function', function(done){
      var process_name = is_windows ? 'node.exe' : 'node';
      index.process_running(process_name, function(response){
        response.should.be.true;
        done();
      })
    });
  });

  describe('scan_networks()', function() {

    it('runs', function(done) {
      if (!is_windows) return done(); // windows only

      index.scan_networks(done);
    });

  });

});
