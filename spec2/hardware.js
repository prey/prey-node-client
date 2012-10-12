
require("../lib/");

var should = require("should");
var common = _ns("common");
var hw = _ns("hardware");
var inspect = require('util').inspect;
var platform = common.os_name;
var td = require('./testdata').td;

describe('Hardware', function(){
  describe('get_mac_address', function(){
    it('should cb a valid mac address', function(done) {
      hw.get_mac_address(td("nic"),function(err,mac) {
        if (err) {
          err.code.should.equal("MALFORMED_MAC"); 
        } else {
          should.exist(mac);
        }
        done();
      });
    });
  });

  describe('get_broadcast_address', function(){
    it('should get broadcast address', function(done) {
      hw.get_broadcast_address(td("nic"),function(err,broadcast) {
        console.log("broadcast:"+broadcast);
        should.exist(broadcast);
        done();
      });
    });
  });
  
  describe('get_network_interfaces_list', function(){
    it('should return at least 1 network interface',function(done) {
      hw.get_network_interfaces_list(function(err,nics) {
        if (err) {
          err.code.should.equal("NO_OSINTERFACE");
        } else {
          nics.should.be.an.instanceOf(Array);
          nics.length.should.be.above(0);
          var nic = nics[0];
          nic.should.have.property('mac');
          nic.should.have.property('name');
          nic.should.have.property('ip_address');
          console.log(inspect(nics));
          done();
        }
      });
    });
  });
  
  describe('get_first_mac_address', function(){
    it('there exists a mac address',function(done) {
      hw.get_first_mac_address(function(err,mac) {
        should.exist(mac);
        done();
      });
    });
  });

  describe('get_firmware_info', function(){
    it('should callback firmware_info',function(done) {
      hw.get_firmware_info(function(err,firmware) {
        should.exist(firmware);

        // !! TOM what is the query on wmic for this stuff?? Not in bash windows file??
        if (platform !== "windows") {
          firmware.should.have.property('vendor_name');
          firmware.should.have.property('model_name');
          firmware.should.have.property('serial_number');
          firmware.should.have.property('uuid');
        }
        firmware.should.have.property('mb_vendor');
        firmware.should.have.property('mb_model');
        firmware.should.have.property('mb_version');
        firmware.should.have.property('mb_serial');
        firmware.should.have.property('bios_vendor');
        firmware.should.have.property('bios_version');
        _tr("FIRMWARE=",firmware);
        done();
      });
    });
  });

  describe('get_processor_info', function(){
    it('should callback an object with model, speed and cores',function(done) {
      hw.get_processor_info(function(err,obj) {
        should.exist(obj);
        obj.should.have.property('speed');
        obj.should.have.property('model');
        obj.should.have.property('cores');
        done();
      });
    });
  });  
});


