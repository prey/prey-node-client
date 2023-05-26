"use strict";

var helpers    = require('./../../../helpers'),
    should     = require('should'),
    provider   = helpers.load('providers/indicators');

describe('indicators', function(){

  describe('get_uptime', function(){

    it('never returns an error');

    it('returns an object', function(done) {

      provider.get_uptime(function(err, uptime) {
        should.not.exist(err); // this getter should never return an error
        uptime.should.be.a.Number;
        done();
      });
    });
  });

   describe('get_remaining_battery', function(){

     describe('when computer has a battery', function(){
       it('returns an object');
     });

     describe('when computer does not have a battery', function(){
       it('returns an error');
     });

   });

   describe('get_battery_status', function(){

     describe('when computer has a battery', function(){
       it('returns an object');
     });

     describe('when computer does not have a battery', function(){
       it('returns an error');
     });

   });


  describe('get_cpu_load', function(){

    it('never returns an error');

    it('returns an object', function(done) {
      provider.get_cpu_load(function(err, load) {
        load.should.have.keys('last_min', 'last_five', 'last_fifteen');
        load.last_five.should.be.a.Number;
        done();
      });
    });

  });

  describe('get_memory_usage', function(){

    it('never returns an error');

    it('returns an object', function(done){

      provider.get_memory_usage(function(err, usage) {
        // Object.keys(usage).should.have.lengthOf(3);
        usage.should.have.keys('used', 'free_bytes', 'total_bytes');
        usage.free_bytes.should.be.a.Number;
        done();
      });

    })

  });

  describe('get_remaining_storage', function(){

    describe('when pc does not have any storage devices', function(){

      it('returns an error');

    });

    describe('when PC has one storage device', function(){

      it('returns an object', function(done){

        provider.get_remaining_storage(function(err, storage) {
          storage.should.have.keys('total_gb','free_gb','used');
          done();
        });

      });

    });

    describe('when PC has more than 1 storage devices', function(){

      it('returns aggregated totals');

    });

  });

});
