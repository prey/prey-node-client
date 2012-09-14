

var should = require("should");
var common = require("../lib/prey/common");
var hw = require("../lib/prey/plugins/providers/hardware");

describe('Hardware', function(){
  describe('get_mac_address', function(){
    it('should cb a valid mac address', function(done) {
      var nic = (common.os_name === "windows") ? "Local Area Connection" : "eth0";
      hw.get_mac_address(nic,function(err,mac) {
        if (err) {
          throw err;
        }
        
        should.exist(mac);
        
        if (common.os_name === "windows") {
          mac.should.equal("08:00:27:8D:55:F3");
        } else {
          mac.should.equal("00:1b:24:bc:b3:80");
        }
        
        done();
      });
    });
  });

  describe('get_network_interfaces_list', function(){
    it('should return at least 1 network interface',function(done) {
      hw.get_network_interfaces_list(function(res) {
        res.length.should.be.above(0);
        done();
      });
    });
  });
  
  
});


