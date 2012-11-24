/*global describe:true it:true */

"use strict";

var helpers    = require('./../../helpers'),
    should     = helpers.should,
    provider   = helpers.load('providers').load('network');

var nic_check = function(nic) {
  nic.should.be.a('object');
  nic.should.have.property('mac');
  nic.should.have.property('name');
  nic.should.have.property('ip_address');
  nic.should.have.property('broadcast_address');
};

var ap_check = function(ap) {
  ap.should.have.property('ssid');
  ap.should.have.property('quality');
  ap.should.have.property('signal_strength');
  ap.should.have.property('noise_level');
  ap.should.have.property('security');
};

describe('Network', function(){
  describe('get_public_ip', function(){
    it('should cb a valid ipaddress', function(done) {
      provider.get_public_ip(function(err,ip) {
        should.exist(ip);
        _tr(ip);
        done();
      });
    });
  });

  describe('get_private_ip',function() {
    it('should cb a private ip',function(done) {
      provider.get_private_ip(function(err,ip) {
        should.exist(ip);
        _tr("Private"+ip);
        done();
      });
    });
  });

  describe('get_broadcast_address',function() {
    it('should cb a broadcast ip',function(done) {
      provider.get_broadcast_address(td('nic'),function(err,broadcast) {
        should.exist(broadcast);
        _tr('broadcast:'+broadcast);
        done();
      });
    });
  });

  describe('get_nic_by_name',function() {
    it('should get either eth0 or Local.. ', function(done) {
      provider.get_nic_by_name(td('nic'),function(err,nic) {
        should.exist(nic);
        nic_check(nic);
        _tr("NIC:"+inspect(nic));
        done();
      });
    });
  });

  describe('get_active_network_interface',function() {
    it('should return a nic', function(done) {
      provider.get_active_network_interface(function(err,nic) {
        if (nic) {
          _tr("active network interface"+inspect(nic));
          nic_check(nic);
        } else {
          _tr('no nic');
        }
        done();
      });
    });
  });

  describe('get_wireless_interface_names',function() {
    it('should return an array of interfaces',function(done) {
      provider.get_wireless_interface_names(function(err,names) {
        if (names) {
          names.should.be.an.instanceOf(Array);
          names.length.should.be.above(0);
          _tr("Wireless interface names (array):"+inspect(names));
        } else {
          _tr ('no wifi');
        }

        done();
      });
    });
  });

  describe('get_first_wireless_interface',function() {
    it('should return the first interface',function(done) {
      net.get_first_wireless_interface(function(err,name) {
        if (!name) {
          _tr('no wifi');
          return done();
        }

        _tr("first interface:"+name);
        done();
      });
    });
  });

  describe('get_access_points_list',function() {
    it('should callback list of access points',function(done) {
      provider.get_access_points_list(function(err,aps) {
        if (!aps) {
          _tr('no wifi')
          return done();
        }

        aps.should.be.an.instanceOf(Array);
        aps.length.should.be.above(0);
        _tr("access points:"+inspect(aps));

        aps.length.should.be.above(0);
        var ap = aps[0];
        ap.should.have.property('ssid');
        ap.should.have.property('quality');
        ap.should.have.property('signal_strength');
        ap.should.have.property('noise_level');
        ap.should.have.property('security');
        done();
      });
    });
  });

  describe('get_active_access_point',function() {
    it('should return an active access point',function(done) {
      provider.get_active_access_point(function(err,ap) {
        if (!ap) {
          _tr('no wifi');
          return done();
        }

        ap_check(ap); // actually mac address but that is checked by the func
        done();
      });
    });
  });

  describe('get_open_access_points_list',function() {
    it('should callback list of open access points',function(done) {
      provider.get_open_access_points_list(function(err,aps) {
        if (!aps) {
          _tr('no wifi');
          return done();
        }

        aps.should.be.an.instanceOf(Array);

        if (aps.length > 0)
          ap_check(ap);

        _tr("access points:"+inspect(aps));
        done();
      });
    });
  });

});
