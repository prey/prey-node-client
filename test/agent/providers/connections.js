var helpers    = require('./../../helpers'),
    should     = helpers.must,
    provider   = helpers.load('providers').load('connections');

describe('Connections', function(){
  describe('get_outbound_connections_list', function(){
    it('should be an array of nic,ip pairs', function(done) {
      provider.get_outbound_connections_list(function(err,val) {
        val.should.be.an.instanceOf(Array);
        var x = val[0];
        x.should.have.property('protocol');
        x.should.have.property('recv');
        x.should.have.property('send');
        x.should.have.property('local_address');
        x.should.have.property('remote_address');
        x.should.have.property('state');
        x.should.have.property('program_pid');
        x.should.have.property('program_name');
        done();
      });
    });
  });
});
