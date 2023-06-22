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
    })

  })

})