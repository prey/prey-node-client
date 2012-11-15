
require("../lib/");

var should = require("should");
var common = _ns("common");
var bandwidth = _ns("bandwidth");
var inspect = require('util').inspect;
var platform = common.os_name;
var td = require('../testdata').td;

describe('Bandwidth', function() {

  describe('get_bandwidth_usage', function(){
    it('', function(done) {
      this.timeout(5000);

      bandwidth.get_bandwidth_usage(function(err,val) {
        if (err) {
          _tr(err);
        }
        should.exist(val);
        val.should.have.property('inBytes');
        val.should.have.property('outBytes');
        _tr(val);
        
        done();
      });
    });
  });

});