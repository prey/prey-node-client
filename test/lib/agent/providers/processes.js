var helpers    = require('./../../../helpers'),
    should     = require('should'),
    provider   = helpers.load('providers/processes');

var check_process = function(val) {
  var obj = val[0];
  var keys = 'status user ppid pid cpu mem time name'.split(' ');
  obj.should.have.keys(keys);
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
