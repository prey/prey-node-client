var helpers    = require('./../../helpers'),
    should     = helpers.must,
    provider   = helpers.load('providers').load('bandwidth');

describe('Bandwidth', function() {

  describe('get_bandwidth_usage', function(){

    it('works', function(done) {

      this.timeout(10000); // this getter takes more than 3 secs to return

      provider.get_bandwidth_usage(function(err, obj) {
        should.not.exist(err);
        obj.should.be.an.instanceof(Object);
        obj.should.have.keys(['in', 'out']);
        done();
      });

    });

  });

});
