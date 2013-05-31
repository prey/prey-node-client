
var join        = require('path').join,
    should      = require('should'),
    index_path  = join(__dirname, '..', '..', '..', 'lib', 'system', 'index.js'); 

describe('lib/system/index_spec.js #wip', function(){

  var index = require(index_path);

  describe('get_logged_user()', function(){

    it('should return the logged user', function(done){
      index.get_logged_user(function(err, user){
        should.not.exist(err);
        should.exist(user);
        user.should.not.be.equal('');
        done();
      });
    });
  });

  describe('tempfile_path()', function(){
    it('should return the path of a file over a tmp directory', function(){
      var path = index.tempfile_path('5db31f301a494fb2a79433434a92e1b2_myfile');
      path.should.not.be.equal('');
      path.should.match(/5db31f301a494fb2a79433434a92e1b2_myfile/);
    });
  });

  describe('spawn_as_logged_user()', function(){
    it('----');
  });
  describe('run_as_logged_user()', function(){
    it('----');
  });
  describe('get_running_user()', function(){
    it('----');
  });
  describe('get_os_info() -> get_os_version + get_os_name', function(){
    it('----');
  });
  describe('set_interval()', function(){
    it('----');
  });
  describe('unset_interval()', function(){
    it('----');
  });
  describe('process_running() -> proxy to os function', function(){
    it('----');
  });
  describe('auto_connect() -> proxy to os_function', function(){
    it('----');
  });
});
