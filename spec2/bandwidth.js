
require("../lib/");

var should = require("should");
var common = _ns("common");
var bandwidth = _ns("bandwidth");
var inspect = require('util').inspect;
var platform = common.os_name;
var td = require('./testdata').td;

describe('Bandwidth', function(){
  describe('get_bandwidth_usage', function(){
    it('', function(done) {
      bandwidth.get_bandwidth_usage(function(err,val) {
        if (err) {
          console.log(err);
        }
        should.exist(val);
        val.should.have.property('inBytes');
        val.should.have.property('outBytes');
        console.log(val);
        
        done();
      });
    });
  });

});