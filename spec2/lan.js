
require("../lib/");

var should = require("should");
var common = _ns("common");
var lan = _ns("lan");
var inspect = require('util').inspect;
var platform = common.os_name;
var td = require('./testdata').td;

describe('Lan', function(){
  describe('get_active_nodes_list', function(){
    it('should be an array of name,ip pairs', function(done) {
      lan.get_active_nodes_list(function(err,val) {
        if (err) {
          console.log(err);
        }
        val.should.be.an.instanceOf(Array);
        if (val.length > 0) {
          var x = val[0];
          x.should.have.property('name');
          x.should.have.property('ip_address');
          console.log(x);
        }
        
        done();
      });
    });
  });

  describe('get_ip_from_hostname', function(){
    it('should be an ip address', function(done) {
      lan.get_ip_from_hostname('SOMENBIOSNAME',function(err,val) {
        if (err) {
          console.log(err);
        }
//        should.exist(val);
 //       console.log("ip from hostname:"+val);
        done();
      });
    });
  });
});