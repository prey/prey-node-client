

/*global describe:true it:true */

"use strict";

require("../lib/");

var should = require("should");
var td = require('./testdata').td;
var inspect = require('util').inspect;
var sys = _ns('system');

var nic_check = function(nic) {
  nic.should.be.a('object');
  nic.should.have.property('mac');
  nic.should.have.property('name');
  nic.should.have.property('ip_address');
  nic.should.have.property('broadcast_address');
};

describe('System', function(){

  describe('get_logged_user', function(){
    it('should get a the current logged user', function(done) {
      sys.get_logged_user(function(err,name) {
        should.exist(name);
        (name.length > 0).should.be.ok;
        console.log(name);
        done();
      });
    });
  });

  describe('get_uptime', function(){
    it('checks how long has system been up', function(done) {

      sys.get_uptime(function(err,uptime) {
        should.exist(uptime);
        done();
      });
    });
  });

   describe('get_remaining_battery', function(){
    it('should get remaining battery life as a % * 100, e.g. 80 = 80%', function(done) {
      sys.get_remaining_battery(function(err,life) {
        if (err) {
          console.log(err);
        }
        console.log(life);
        should.exist(life);
        life.should.be.a('string');
        life.slice(-1).should.equal('%');
        done();
      });
    });
  });


  describe('get_cpu_load', function(){
    it('should get cpu load', function(done) {
      sys.get_cpu_load(function(err,load) {
        if (err) {
          console.log(err);
        }

        load.should.have.property('last_min')
        load.last_min.should.be.a('number');
        load.should.have.property('last_five');
        load.should.have.property('last_fifteen');

        done();
      });
    });
  });

  describe('get_memory_usage', function(){
    it('should get memory usage', function(done) {
      sys.get_memory_usage(function(err,usage) {
        if (err) {
          console.log(err);
        }

        should.exist(usage);

        usage.should.have.property('total_bytes');
        usage.should.have.property('free_bytes');
        usage.should.have.property('used');

        usage.total_bytes.should.be.a('number');
        usage.free_bytes.should.be.a('number');
        usage.used.should.be.a('string');
        
        done();
      });
    });
  });

  describe('get_os_name', function(){
    it('should get os name', function(done) {
      sys.get_os_name(function(err,name) {
        if (err) {
          console.log(err);
        }

        should.exist(name);
        name.should.be.a('string');
        
        done();
      });
    });
  });

  describe('get_os_version', function(){
    it('should get os version', function(done) {
      sys.get_os_name(function(err,version) {
        if (err) {
          console.log(err);
        }

        should.exist(version);
        version.should.be.a('string');
        
        done();
      });
    });
  });

  describe('get_remaining_storage', function(){
    it('should get remaining disk space', function(done) {
      sys.get_remaining_storage(function(err,storage) {
        if (err) {
          console.log(err);
        }

        should.exist(storage);
        storage.should.be.a('object');
        storage.should.have.keys(['size_gb','free_gb','used']);
        storage.size_gb.should.be.a('string');
        storage.free_gb.should.be.a('string');
        storage.used.should.be.a('string');
        done();
      });
    });
  });

  
    

});