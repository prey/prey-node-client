"use strict";

var helpers    = require('./../helpers'),
    should     = helpers.must,
    system     = require('./../../lib/system');

describe('System', function(){

  describe('get_logged_user', function(){

    it('should get a the current logged user', function(done) {
      system.get_logged_user(function(err, name) {
        should.not.exist(err);
        (name.length > 0).should.be.ok;
        done();
      });
    });

  });

  describe('get_os_name', function(){

    it('should get os name', function(done) {
      system.get_os_name(function(err, name) {
        should.not.exist(err);
        name.should.be.a('string');
        done();
      });
    });

  });

  describe('get_os_version', function(){

    it('should get os version', function(done) {
      system.get_os_name(function(err, version) {
        should.not.exist(err);
        version.should.be.a('string');
        done();
      });
    });

  });

});
