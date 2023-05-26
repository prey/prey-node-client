/*global describe:true it:true */

/*

"use strict";

var helpers    = require('./../../helpers'),
    should     = helpers.must,
    sinon      = helpers.sinon,
    provider   = helpers.load('providers').load('network');

var nic_check = function(nic) {
  nic.should.be.a('object');
  nic.should.have.property('name');
  nic.should.have.property('ip_address');
  nic.should.have.property('mac_address');
  nic.should.have.property('netmask');
};

var ap_check = function(ap) {
  ap.should.have.property('ssid');
//   ap.should.have.property('quality');
  ap.should.have.property('mac_address');
  ap.should.have.property('signal_strength');
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

      it('returns an error');

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

  describe('get private_ip',function() {

    describe('when all interfaces are down', function(){

      it('returns an error');

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

        it('returns an error');

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

  describe('get_wireless_interfaces_list',function() {

    describe('when device has no wifi support', function(){


    })

    describe('when device has wifi support', function(){

      it('should return an array of interfaces',function(done) {
        provider.get_wireless_interfaces_list(function(err, list) {
          list.should.be.an.instanceOf(Array);
          list.length.should.be.above(0);
          done();
        });
      });

    })

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

          it('should return an active access point');

        })

      })

    })

  });

  describe('get_open_access_points_list',function() {

     describe('when no access points are found', function(){

      it('returns an error');

     });

     describe('when access points are found', function(){

       var list = require('./fixtures/parsed_access_points_list');

/*

       describe('and none have security=false', function(){

         before(function(){
           list = list.filter(function(x){ return x.security !== false })

           sinon.stub(provider, 'get_access_points_list', function(cb){
             cb(null, list);
           })
         })

         it('returns an error', function(done){

           provider.get_open_access_points_list(function(err, aps) {
            should.exist(err);
            should.not.exist(aps);
            provider.get_access_points_list.restore();
            done();
           });

         });

       })

*/

/*
       describe('and one or more are open', function(){

         before(function(){
           sinon.stub(provider, 'get_access_points_list', function(cb){
             cb(null, list);
           })
         })

         it('should callback list of open access points', function(done) {

          provider.get_open_access_points_list(function(err, aps) {
            should.not.exist(err);
            aps.should.be.an.instanceOf(Array);
            aps.should.have.lengthOf(2);
            ap_check(aps[0]);
            provider.get_access_points_list.restore();
            done();
          });

        });

      });

    });

  });

});

*/
