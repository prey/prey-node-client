var helpers = require('./../../../../../helpers'),
    should  = require('should'),
    fs      = require('fs');

var provider = helpers.load('providers/network/mac');
var scan     = fs.readFileSync(__dirname + '/../../fixtures/airport_scan.txt');

describe('get_access_points_list', function(){

  describe('when no wifi network is found', function(){

  });

  describe('when wifi network is present', function(){

    describe('with no output', function(){

      it('returns an error', function(){

      });

    });

    describe('with invalid output', function(){

      it('returns an error', function(){

      });

    });

    describe('with valid output is received', function(){

      var list = provider.parse_access_points_list(scan);

      it('returns an array of APs', function(){
        list.should.be.an.instanceof(Object);
        list.should.have.lengthOf(10);
      });

      it('returns a valid set of objects in array', function(){
        var ap = list[0];
        Object.keys(ap).length.should.equal(5);
        ap.should.have.keys('ssid', 'mac_address', 'signal_strength', 'channel', 'security')
      })

      it('sorts them by proximity', function(){

      })

    });

  });

});