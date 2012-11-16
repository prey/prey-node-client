
require("../lib/");

var should = require("should");
var common = _ns("common");
var process = _ns("processes");
var inspect = require('util').inspect;
var platform = common.os_name;
var td = require('../testdata').td;

var check_process = function(val) {
  val.should.be.an.instanceOf(Array);
  if (val.length > 0) {
    var x = val[0];
    x.should.have.property('status');
    x.should.have.property('user');
    x.should.have.property('ppid');
    x.should.have.property('cpu');
    x.should.have.property('mem');
    x.should.have.property('time');
    x.should.have.property('name');
  }
  _tr(val)
};

describe('Processes', function(){
  describe('get_process_list', function(){
    it('should be an array of process', function(done) {
      process.get_parent_process_list(function(err,val) {
        if (err) {
          _tr(err);
          return done();
        }
        check_process(val);
        done();
      });
    });
  });

  describe('get_parent_process_list', function(){
    it('should be an array of parent process', function(done) {
      process.get_parent_process_list(function(err,val) {
        if (err) {
          _tr(err);
          return done();
        }
        check_process(val);
        done();
      });
    });
  });
});

