/*global describe:true it:true */

"use strict";

require("../lib/");

var should = require("should");
var td = require('./testdata').td;
var inspect = require('util').inspect;
var net = _ns('network');

var nic_check = function(nic) {
  nic.should.be.a('object');
  nic.should.have.property('mac');
  nic.should.have.property('name');
  nic.should.have.property('ip_address');
  nic.should.have.property('broadcast_address');
};

describe('Network', function(){
  describe('get_public_ip', function(){
    it('should cb a valid ipaddress', function(done) {
      net.get_public_ip(function(err,ip) {
        should.exist(ip);
        console.log(ip);
        done();
      });
    });
  });

  describe('get_private_ip',function() {
    it('should cb a private ip',function(done) {
      net.get_private_ip(function(err,ip) {
        should.exist(ip);
        console.log("Private"+ip);
        done();
      });
    });
  });

  describe('get_broadcast_address',function() {
    it('should cb a broadcast ip',function(done) {
      net.get_broadcast_address(td('nic'),function(err,broadcast) {
        should.exist(broadcast);
        console.log('broadcast:'+broadcast);
        done();
      });
    });
  });

  describe('get_nic_by_name',function() {
    it('should get either eth0 or Local.. ', function(done) {
      net.get_nic_by_name(td('nic'),function(err,nic) {
        should.exist(nic);
        nic_check(nic);
        console.log("NIC:"+inspect(nic));
        done();
      });
    });
  });

  describe('get_active_network_interface',function() {
    it('should return a nic', function(done) {
      net.get_active_network_interface(function(err,nic) {
        console.log("active network interface"+inspect(nic));
        nic_check(nic);
        done();
      });
    });
  });

  describe('get_wireless_interface_names',function() {
    it('should return an array of interfaces',function(done) {
      net.get_wireless_interface_names(function(err,names) {
        should.exist(names);
        console.log("Wireless interface names (array):"+inspect(names));
        done();
      });
    });
  });

  describe('get_first_wireless_interface',function() {
    it('should return the first interface',function(done) {
      net.get_first_wireless_interface(function(err,name) {
        should.exist(name);
        console.log("first interface:"+name);
        done();
      });
    });
  });

  describe('get_access_points_list',function() {
    it('should callback list of access points',function(done) {
      net.get_access_points_list(function(err,aps) {
        should.exist(aps);
        console.log("access points:"+inspect(aps));
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
      net.get_active_access_point(function(err,ap) {
        should.exist(ap);
        done();
      });
    });
  });

  describe('get_open_access_points_list',function() {
    it('should callback list of open access points',function(done) {
      net.get_open_access_points_list(function(err,aps) {
        should.exist(aps);
        console.log("access points:"+inspect(aps));
        done();
      });
    });
  });

  
});