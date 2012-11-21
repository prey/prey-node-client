var should = require('should'),
    fs = require('fs');

console.log('sss');

describe('get_access_points_list', function(){

  describe('when no wifi network is found', function(){

  });

  describe('when wifi network is present', function(){

    describe('in windows', function(){

      describe('and an empty list is received', function(){

        it('returns an error', function(){

        });

      });

      describe('and at least one network is found', function(){

        it('returns a valid hash', function(){

        });

      });

    });

    describe('in mac', function(){

      var mac = require('./../../../../lib/agent/plugins/providers/network/platform/mac');

      describe('and an empty list is received', function(){

        it('returns an error', function(){

        });

      });

      describe('and at least one network is found', function(){

        var scan = fs.readFileSync(__dirname + '/fixtures/airport_scan.xml');

        it('returns a valid hash', function(){
          var list = mac.parse_access_points_list(scan);
          console.log(list);
          list.should.be.a(Object);
          list.length.should.be(4);
        });

      });

    });

    describe('in linux', function(){

      describe('and an empty list is received', function(){

        it('returns an error', function(){

        });

      });

      describe('and at least one network is found', function(){

        it('returns a valid hash', function(){

        });

      });

    });

  });

});
