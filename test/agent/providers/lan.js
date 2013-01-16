var helpers    = require('./../../helpers'),
    should     = helpers.must,
    provider   = helpers.load('providers').load('lan');

describe('Lan', function(){

  describe('get_active_nodes_list', function(){

    describe('when PC is not connected', function(){

      it('returns an error');

    });

    describe('when PC is connected', function(){

      describe('and no PCs are nearby', function(){

        it('returns an error');

      });

      describe('and one or more PCs are on the same LAN', function(){

        it('does not return an error');

        it('returns an array of name/ip pairs');

      });

    });

  });

});
