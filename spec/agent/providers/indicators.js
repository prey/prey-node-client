/*global describe:true it:true */

"use strict";

var helpers    = require('./../../helpers'),
    should     = helpers.must,
    provider   = helpers.load('providers').load('indicators');

describe('indicators', function(){

  describe('get_uptime', function(){
    it('checks how long has system been up', function(done) {

      provider.get_uptime(function(err,uptime) {
        should.exist(uptime);
        done();
      });
    });
  });

   describe('get_remaining_battery', function(){
    it('should get remaining battery life as a % * 100, e.g. 80 = 80%', function(done) {
      provider.get_remaining_battery(function(err,life) {
        should.exist(life);
        life.should.be.a('string');
        life.slice(-1).should.equal('%');
        done();
      });
    });
  });


  describe('get_cpu_load', function(){
    it('should get cpu load', function(done) {
      provider.get_cpu_load(function(err,load) {
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
      provider.get_memory_usage(function(err,usage) {
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

  describe('get_remaining_storage', function(){
    it('should get remaining disk space', function(done) {
      provider.get_remaining_storage(function(err,storage) {
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
