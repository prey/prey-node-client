var helpers    = require('./../../../helpers'),
    should     = require('should'),
    provider   = helpers.load('providers/hardware');

describe('hardware', function(){

  describe('first_mac_address', function() {

    it('should cb a valid mac address', function(done) {
      provider.get_first_mac_address(function(err, mac) {
        should.exist(mac);
        mac.should.have.lengthOf(17);
        done();
      });
    });

  });

  describe('network_interfaces_list', function() {

    it('should return at least 1 network interface',function(done) {
      provider.get_network_interfaces_list(function(err, nics) {

        should.not.exist(err);

        nics.should.be.an.Array;
        nics.length.should.be.above(0);

        var nic = nics[0];
        nic.should.have.keys(['name', 'type', 'ip_address', 'mac_address']);
        done();
      });
    });
  });

  describe('get_firmware_info', function(){

    // in linux there's a scenario when we don't have access to dmidecode
    describe('with no access to system info', function() {

      it('returns error');

    });

    describe('with access to sys info', function() {

      it('works')

    })

  });

  describe('get_processor_info', function(){

    it('should callback an object with model, speed and cores',function(done) {

      provider.get_processor_info(function(err, obj) {
        should.not.exist(err);
        obj.should.have.keys(['speed', 'model', 'cores']);
        done();
      });

    });

  });

});
