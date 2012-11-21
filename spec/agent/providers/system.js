

/*global describe:true it:true */

"use strict";

var helpers    = require('./../../spec_helpers'),
    should     = helpers.should,
    provider   = helpers.load('providers').load('system');

describe('System', function(){

  describe('get_logged_user', function(){
    it('should get a the current logged user', function(done) {
      provider.get_logged_user(function(err,name) {
        should.exist(name);
        (name.length > 0).should.be.ok;
        _tr(name);
        done();
      });
    });
  });

  describe('get_os_name', function(){
    it('should get os name', function(done) {
      provider.get_os_name(function(err,name) {
        if (err) {
          _tr(err);
        }

        should.exist(name);
        name.should.be.a('string');

        done();
      });
    });
  });

  describe('get_os_version', function(){
    it('should get os version', function(done) {
      provider.get_os_name(function(err,version) {
        if (err) {
          _tr(err);
        }

        should.exist(version);
        version.should.be.a('string');

        done();
      });
    });
  });

});
