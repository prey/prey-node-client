/*global describe:true it:true */

"use strict";

var helpers    = require('./../../helpers'),
    should     = helpers.must,
    provider   = helpers.load('providers').load('network');

var nic_check = function(nic) {
  nic.should.be.a('object');
  nic.should.have.property('name');
  nic.should.have.property('ip_address');
  nic.should.have.property('mac_address');
  nic.should.have.property('broadcast_address');
};

var ap_check = function(ap) {
  ap.should.have.property('ssid');
  ap.should.have.property('quality');
  ap.should.have.property('mac_address');
  ap.should.have.property('signal_strength');
  ap.should.have.property('noise_level');
  ap.should.have.property('security');
};

var nic_names = {
  linux: 'eth0',
  darwin: 'en0',
  win32: 'Local Area Connection'
}

var nic_name = nic_names[process.platform];

var ip_regex = /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})$/;


describe('Network', function(){

  describe('get_public_ip', function(){

    describe('when not connected', function(){

    })

    describe('when connected to the internet', function(){

      it('should cb a valid ipaddress', function(done) {
        provider.get_public_ip(function(err,ip) {
          should.not.exist(err)
          ip.should.match(ip_regex);
          done();
        });
      });

    })

  });

  describe('get_private_ip',function() {

    describe('when all interfaces are down', function(){

    })

    describe('when one interface is up', function(){

      describe('and with an assigned ip', function(){

        it('should cb a private ip',function(done) {
          provider.get_private_ip(function(err, ip) {
            should.not.exist(err);
            ip.should.match(ip_regex);
            done();
          });
        });

      })

      describe('with no assigned ip', function(){

      })

    })

    describe('when multiple interfaces are up', function(){

      describe('and none have assigned IPs', function(){

      })

      describe('and one has assigned IP', function(){

      })

      describe('and more than one has an assigned IP', function(){

        // it should return the IP of the

      })

    })

  });

  describe('broadcast_address', function() {

    describe('when interface does not exist', function(){

    })

    describe('when interface exists', function(){

      describe('and interface is down', function(){

      })

      describe('and interface has an active connection', function(){

        it('should cb a broadcast ip', function(done) {
          provider.broadcast_address_for(nic_name,function(err,broadcast) {
            should.exist(broadcast);
            done();
          });
        });

      })

    })

  });

  describe('get_active_network_interface',function() {

    describe('when no interfaces are active', function(){

    })

    describe('when one interface is active', function(){

      it('should return a nic object', function(done) {
        provider.get_active_network_interface(function(err, nic) {
          should.not.exist(err);
          nic_check(nic);
          done();
        });
      });

    })

    describe('when more than one interface is active', function(){

    })

  });

  describe('get_wireless_interface_names',function() {

    describe('when device has no wifi support', function(){


    })

    describe('when device has wifi support', function(){

      it('should return an array of interfaces',function(done) {
        provider.get_wireless_interface_names(function(err,names) {
          names.should.be.an.instanceOf(Array);
          names.length.should.be.above(0);
          done();
        });
      });

    })

  });

  describe('get_first_wireless_interface',function() {

    describe('when device has no wifi support', function(){


    })

    describe('when device has wifi support', function(){

      it('should return the first interface',function(done) {
        provider.get_first_wireless_interface(function(err, name) {
          should.not.exist(err);
          done();
        });
      });

    });

  });

  describe('get_active_access_point',function() {

    describe('when device is not connected via wifi', function(){

    })

    describe('when device is connected via wifi', function(){

      describe('and no access points are found (weird case)', function(){

      })

      describe('and access points are found', function(){

        describe('and none match the MAC address of the active one', function(){

        })

        describe('and a match is found', function(){

          it('should return an active access point',function(done) {
            provider.get_active_access_point(function(err ,ap) {
              ap_check(ap); // actually mac address but that is checked by the func
              done();
            });
          });

        })

      })

    })

  });

  describe('get_open_access_points_list',function() {

     describe('when no access points are found', function(){

     });

     describe('when access points are found', function(){

       describe('and none have security=false', function(){

       })

       describe('and one or more are open', function(){

         it('should callback list of open access points',function(done) {

          provider.get_open_access_points_list(function(err, aps) {
            aps.should.be.an.instanceOf(Array);
            ap_check(ap[0]);
            done();
          });

        });

      });

    });

  });

});
