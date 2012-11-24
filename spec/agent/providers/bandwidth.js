var helpers    = require('./../../helpers'),
    should     = helpers.should,
    provider   = helpers.load('providers').load('bandwidth');

describe('Bandwidth', function() {

  describe('get_bandwidth_usage', function(){

    it('works', function(done) {

      this.timeout(5000);

      bandwidth.get_bandwidth_usage(function(err, val) {
        if (err) {
          _tr(err);
        }
        should.exist(val);
        val.should.have.property('inBytes');
        val.should.have.property('outBytes');
        _tr(val);

        done();
      });
    });
  });

});
