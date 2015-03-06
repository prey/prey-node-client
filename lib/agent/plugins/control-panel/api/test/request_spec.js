var sinon   = require('sinon'),
    should  = require('should'),
    needle  = require('needle'),
    api_req = require('../request');

describe('API Request Wrapper', function() {

  describe('.use', function() {

    it('overrides defaults', function() {
      var defaults = api_req.use({
        host: 'http://foobar.com',
        retry_timeout: 100
      });
      defaults.host.should.equal('http://foobar.com');
    });

  });

});
