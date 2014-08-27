var helpers    = require('../helpers'),
    sinon      = require('sinon'),
    should     = require('should'),
    needle     = require('needle');

var module     = require(helpers.lib_path('plugins'));

describe('plugins', function() {

  describe('get_enabled()', function() {

    var call = function() {
      return module.get_enabled();
    }

    describe('when not initialized', function() {

      // this test fails when running the full suite, because common
      // initializes this guy before this test is run

      /*

      it('throws an error', function() {
        (function() {
          call();
        }).should.throw(/not initialized/);
      })

      */

    })

    describe('when intialized with no config object', function() {

      before(function() {
        module.init(null);
      })

      it('throws an error', function() {
        (function() {
          call();
        }).should.throw(/not initialized/);
      })

    })

    describe('with a valid config object', function() {

      var result; // holder for the result value
      var obj = { get: function(key) { return result } }

      before(function() {
        module.init(obj);
      })

      describe('and missing plugin_list key', function() {

        before(function() {
          result = undefined;
        })

        it('returns an empty array', function() {
          var res = call();
          res.should.be.a.Array;
          res.length.should.eql(0);
        })

      })

      describe('and existing, but empty plugin_list key', function() {

        before(function() {
          result = [''];
        })

        it('returns an empty array', function() {
          var res = call();
          res.should.be.a.Array;
          res.length.should.eql(0);
        })

      })

      describe('and plugin_list contains an array', function() {

        describe('and it contains one nonexisting plugin', function() {

          before(function() {
            result = ['bluemeth'];
          });

          // this is on purpose, by the way. we WANT the agent to know
          // if a nonexisting plugin is set in the config.
          it('returns that element in result', function() {
            var res = call();
            res.should.be.a.Array;
            res.length.should.eql(1);
            res[0].should.equal('bluemeth');
          })

        })

        describe('and it contains one existing plugin', function() {

          before(function(){
            result = ['console'];
          });

          // this is on purpose, by the way. we WANT the agent to know
          // if a nonexisting plugin is set in the config.
          it('returns that element in result', function() {
            var res = call();
            res.should.be.a.Array;
            res.length.should.eql(1);
            res[0].should.equal('console');
          })

        })

        describe('and it contains multiple plugins, one nonexisting', function() {

          before(function(){
            result = ['bluemeth', 'console'];
          })

          // this is on purpose, by the way. we WANT the agent to know
          // if a nonexisting plugin is set in the config.
          it('returns that element in result', function() {
            var res = call();
            res.should.be.a.Array;
            res.length.should.eql(2);
            res.should.eql(['bluemeth', 'console']);
          })

        })

        describe('and it contains multiple plugins, all existing', function() {

          before(function(){
            result = ['campfire', 'console'];
          })

          // this is on purpose, by the way. we WANT the agent to know
          // if a nonexisting plugin is set in the config.
          it('returns that element in result', function() {
            var res = call();
            res.should.be.a.Array;
            res.length.should.eql(2);
            res.should.eql(['campfire', 'console']);
          })

        })

      })

    })

  })

})