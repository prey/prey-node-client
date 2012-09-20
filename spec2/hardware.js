
Prey = require("../lib/");

var should = require("should");
var common = Prey.common;
var hw = require("../lib/prey/plugins/providers/hardware");

var td = require('./testdata').td;

describe('Hardware', function(){
  describe('get_mac_address', function(){
    it('should cb a valid mac address', function(done) {
      hw.get_mac_address(td("nic"),function(mac) {
        should.exist(mac);
        mac.should.equal(td("mac"));
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
  
  describe('get_first_mac_address', function(){
    it('there exists a mac address',function(done) {
      hw.get_first_mac_address(function(mac) {
        should.exist(mac);
        done();
      });
    });
  });

  describe('get_firmware_info', function(){
    it('should callback firmware_info',function(done) {
      hw.get_firmware_info(function(firmware) {
        should.exist(firmware);
        firmware.should.have.property('vendor_name');
        firmware.should.have.property('model_name');
        firmware.should.have.property('serial_number');
        firmware.should.have.property('uuid');
        firmware.should.have.property('mb_vendor');
        firmware.should.have.property('mb_model');
        firmware.should.have.property('mb_version');
        firmware.should.have.property('mb_serial');
        firmware.should.have.property('bios_vendor');
        firmware.should.have.property('bios_version');
        
        done();
      });
    });
  });


  describe('get_processor_info', function(){
    it('should callback an object with model, speed and cores',function(done) {
      hw.get_processor_info(function(obj) {
        should.exist(obj);
        obj.should.have.property('speed');
        obj.should.have.property('model');
        obj.should.have.property('cores');
        done();
      });
    });
  });

  
});


