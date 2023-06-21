var helpers = require('./../../../../helpers'),
    should = require('should'),
    sinon = require('sinon'),
    geo = helpers.load('providers/geo'),
    strats = helpers.load('providers/geo/strategies');

describe('geoloc fallback', function() {

  var stubs = {},
      err = new Error('Whoops. Something went wrong'),
      err_cb = function(cb) { return cb(err, null); },
      success_cb = function(cb) { return cb(null, {lat: 1, lng: 1, method: 'something'}) };

  function setup_stubs(cbs) {
    var cbs_len = cbs.length;

    if (cbs_len && cbs_len < 3) {

      ['native', 'wifi'].forEach(function(strat, i) {
        if (cbs_len === 1) {
          stubs[strat] = sinon.stub(strats, strat).callsFake(cbs[0]);
        } else if (cbs[i] && typeof cbs[i] === 'function') {
          stubs[strat] = sinon.stub(strats, strat).callsFake(cbs[i]);
        }
      });

    } else {
      throw new Error('Wrong number of arguments, must be between 1 and 3.');
    }

  }

  function restore_stubs() {
    ['native', 'wifi'].forEach(function(strat) {
      if (stubs[strat]) {
        stubs[strat].restore();
      }
    });

    stubs = {};
  }

  describe('when all strategies fail', function() {

    before(function() {
      setup_stubs([err_cb]);
    });

    after(function() {
      restore_stubs();
    });
  });

  describe('when running osx', function() {

    var original_platform,
        geonative_spy;

    before(function() {
      original_platform = process.platform;
      process.platform = 'darwin';
      geonative_spy = sinon.spy(strats, 'native');
      setup_stubs([null, success_cb]);
    });

    after(function() {
      process.platform = original_platform;
      geonative_spy.restore();
      restore_stubs();
    });

    it('fallbacks to wifi strategy', function(done) {
      geo.fetch_location(function(err, res) {
        geonative_spy.calledOnce.should.be.true;
        stubs.wifi.calledOnce.should.be.true;
        done();
      });
    });

  });


});
