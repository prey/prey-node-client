var helpers    = require('./../../helpers'),
    should     = helpers.must,
    provider   = helpers.load('providers').load('bandwidth');

describe('Bandwidth', function() {

  describe('get_bandwidth_usage', function(){

    it('works', function(done) {

      this.timeout(5000);

      provider.get_bandwidth_usage(function(err, val) {
        should.exist(val);
        val.should.have.property('inBytes');
        val.should.have.property('outBytes');
        done();
      });
    });
  });

});
