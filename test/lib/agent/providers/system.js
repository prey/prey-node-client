

/*global describe:true it:true */

"use strict";

var helpers    = require('./../../helpers'),
    should     = helpers.must,
    provider   = helpers.load('providers').load('system');

describe('System', function(){

  describe('get_logged_user', function(){
    it('should get a the current logged user', function(done) {
      provider.get_logged_user(function(err, name) {
        should.exist(name);
        (name.length > 0).should.be.ok;
        done();
      });
    });
  });

});
