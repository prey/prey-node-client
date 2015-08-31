"use strict";

var helpers = require('./../../../helpers'),
    should = require('should'),
    sinon = require('sinon'),
    geo = helpers.load('providers/geo'),
    geofence = helpers.load('triggers/geofence');

var get_location_stub,
    defaults = {
      accuracy: 10,
      method: 'wifi'
    };

function stub_get_location(location) {
  get_location_stub = sinon.stub(geo, 'get_location', function(cb) {
    var res = {
      lat: location.lat,
      lng: location.lng,
      accuracy: location.accuracy || defaults.accuracy,
      method: location.method || defaults.method
    };

    cb(null, res);
  });
}

describe('geofence trigger', function() {

  describe('with one geofence', function() {

    describe('on start', function() {

      describe('when options does not include origin', function() {

        var opts = {};

        it('does not set fence', function() {});

        it('calls cb with error', function() {});

      });

      describe('when options include origin', function() {

        var opts = {origin: {lat: -33.4421755, lng: -70.6271705}};


        it('sets fence with default radius and interval', function(done) {

          geofence.start(opts, function(err, gf) {
            gf.origin.should.eql(opts.origin);
            gf.radius.should.equal(1000);
            gf.interval.should.equal(60000);
            done();
          });

        });

      });

      describe('and device inside the fence', function() {

        describe('and was previously outside the fence', function() {

          var opts = {origin: {lat: -33.4421755, lng: -70.6271705}};

          it('triggers "entered_geofence" event', function(done) {

            var clock = sinon.useFakeTimers();

            geofence.start(opts, function(err, gf) {

              gf.on('entered_geofence', function(coords) {
                coords.should.eql({lat: opts.origin.lat, lng: opts.origin.lng, accuracy: defaults.accuracy, method: defaults.method});
                done();
              });

              // fast-forward 1 minute to set last_coords
              stub_get_location({lat: -30, lng: -68});
              clock.tick(60000);
              get_location_stub.restore();
              stub_get_location({lat: -33.4421755, lng: -70.6271705});
              clock.tick(60000);
              clock.restore();
              get_location_stub.restore();

              process.nextTick(function() {
                should.fail('"entered_geofence" event not triggered');
                done();
              });
            });

          });

        });

      });

      describe('and device outside the fence', function() {

        describe('and was previously inside the fence', function() {

          var opts = {origin: {lat: -33.4421755, lng: -70.6271705}};

          it('triggers "left_geofence" event', function(done) {

            var clock = sinon.useFakeTimers();

            geofence.start(opts, function(err, gf) {

              var outside_location = {lat: -30, lng: -68}

              gf.on('left_geofence', function(coords) {
                coords.should.eql({lat: outside_location.lat, lng: outside_location.lng, accuracy: defaults.accuracy, method: defaults.method});
                done();
              });

              // fast-forward 1 minute to set last_coords
              stub_get_location({lat: -33.4421755, lng: -70.6271705});
              clock.tick(60000);
              get_location_stub.restore();
              stub_get_location(outside_location);
              clock.tick(60000);
              clock.restore();
              get_location_stub.restore();

              process.nextTick(function() {
                should.fail('"left_geofence" event not triggered');
                done();
              });
            });
          });

        });

      });

    });

    describe('on stop', function() {});

  });

  describe('with two geofences', function() {
  });

});
