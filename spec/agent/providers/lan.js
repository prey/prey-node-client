var helpers    = require('./../../helpers'),
    should     = helpers.should,
    provider   = helpers.load('providers').load('lan');

describe('Lan', function(){
  describe('get_active_nodes_list', function(){
    it('should be an array of name,ip pairs', function(done) {
      provider.get_active_nodes_list(function(err,val) {
        if (err) {
          _tr(err);
        }
        val.should.be.an.instanceOf(Array);
        if (val.length > 0) {
          var x = val[0];
          x.should.have.property('name');
          x.should.have.property('ip_address');
          _tr(x);
        }

        done();
      });
    });
  });

  describe('get_ip_from_hostname', function(){
    it('should be an ip address');
  });
});
