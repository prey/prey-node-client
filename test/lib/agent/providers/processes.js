var helpers    = require('./../../../helpers'),
    should     = require('should'),
    provider   = helpers.load('providers/processes');

if (process.platform == 'win32')
  var process_keys = 'name ppid pid time'.split(' ');
else
  var process_keys = 'status user ppid pid cpu mem time name'.split(' ');

var check_process = function(val) {
  var obj = val[0];

  process_keys.forEach((key) => {
    obj.should.have.key(key);
  })
};

describe('processes', function(){

  describe('process_list', function() {
    it('should be an array of process', function(done) {
      provider.get_parent_process_list(function(err, val) {
        should.not.exist(err);
        check_process(val);
        done();
      });
    });
  });

  describe('parent_process_list', function() {
    it('should be an array of parent process', function(done) {
      provider.get_parent_process_list(function(err, val) {
        should.not.exist(err);
        check_process(val);
        done();
      });
    });
  });

});
