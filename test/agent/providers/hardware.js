var helpers    = require('./../../helpers'),
    should     = helpers.must,
    provider   = helpers.load('providers').load('hardware');

var nic_names = {
  win32:  'Local Area Connection',
  linux:  'eth0',
  darwin: 'en0'
}

var nic_name = nic_names[process.platform];

describe('Hardware', function(){

  describe('get_mac_address', function(){
    it('should cb a valid mac address', function(done) {
      provider.mac_address_for(nic_name, function(err,mac) {
        should.exist(mac);
        mac.should.have.lengthOf(17);
        done();
      });
    });
  });

  describe('get_network_interfaces_list', function(){
    it('should return at least 1 network interface',function(done) {
      provider.get_network_interfaces_list(function(err,nics) {

        nics.should.be.an.instanceOf(Array);
        nics.length.should.be.above(0);

        var nic = nics[0];
        nic.should.have.property('name');
        nic.should.have.property('ip_address');
        nic.should.have.property('mac_address');
        done();
      });
    });
  });

  describe('get_first_mac_address', function(){
    it('there exists a mac address',function(done) {
      provider.get_first_mac_address(function(err, mac) {
        should.exist(mac);
        done();
      });
    });
  });

/*

  describe('get_firmware_info', function(){

    it('should callback firmware_info',function(done) {

      provider.get_firmware_info(function(err, firmware) {
        should.exist(firmware);

        var keys = 'mb_vendor mb_model mb_version mb_serial bios_vendor bios_version';

        if (platform !== "windows") {
          keys += 'model_name vendor_name serial_number uuid';
        }

        firmware.should.have.keys(keys.split(' '));
        done();
      });
    });

  });

*/

  describe('get_processor_info', function(){

    it('should callback an object with model, speed and cores',function(done) {

      provider.get_processor_info(function(err, obj) {
        should.not.exist(err);
        obj.should.be.an.instanceof(Object);
        Object.keys(obj).should.have.lengthOf(3);
        obj.should.have.keys(['speed', 'model', 'cores']);
        done();
      });

    });

  });

});
