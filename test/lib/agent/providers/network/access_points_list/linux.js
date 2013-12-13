var helpers = require('./../../../../../helpers'),
    should  = require('should'),
    fs      = require('fs');

var provider = helpers.load('providers/network/linux');

describe('get_access_points_list', function(){

  describe('when no wifi network is found', function(){

    it('returns an error');

  });

  describe('when wifi network is present', function(){

    describe('with no output', function(){

      it('returns an error');

    });

    describe('with invalid output', function(){

      it('returns an error');

    });

    describe('with valid output is received', function(){

      it('returns an array of APs');

      it('returns a valid set of objects in array')

      it('sorts them by proximity')

    });

  });

});
