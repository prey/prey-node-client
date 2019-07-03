var helpers    = require('./../../../helpers'),
    should     = require('should'),
    provider   = helpers.load('providers/connections');

describe('get_outbound_connections_list', function(){

  it('should return a list of connections', function(done) {

    provider.get_outbound_connections_list(function(err, arr) {

      arr.should.be.an.instanceOf(Array);
      var conn = arr[0];
      Object.keys(conn).should.have.lengthOf(8);
      
      conn.should.have.keys('protocol', 'recv', 'send', 'local_address', 'remote_address', 'state', 'program_pid', 'program_name');
      done();

    });

  });

});