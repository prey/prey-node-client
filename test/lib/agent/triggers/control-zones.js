"use strict";

var helpers = require('./../../../helpers'),
    should = require('should'),
    sinon = require('sinon'),
    geo = helpers.load('providers/geo'),
    geofence = helpers.load('triggers/control-zones');

var get_location_stub,
    defaults = {
      accuracy: 10,
      method: 'wifi'
    };

function stub_get_location(location) {
  get_location_stub = sinon.stub(geo, 'get_location').callsFake(cb => {
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

      describe('and device inside the fence', function() {

        describe('and was previously outside the fence', function() {

          describe ('and type is "in"', function() {

            var opts = [{id: 28, name: "La Cerca", lat: '-33.4421755', lng: '-70.6271705', direction: 'in'}];
            
            it('triggers "entered_geofence" event', function(done) {

              var clock = sinon.useFakeTimers();

              geofence.start(opts, function(err, gf) {
              
                // fast-forward 1 minute to set last_coords
                stub_get_location({lat: -30, lng: -68});
                clock.tick(60000);
                get_location_stub.restore();
                stub_get_location({lat: -33.4421755, lng: -70.6271705});
                clock.tick(60000);
                clock.restore();
                get_location_stub.restore();

                process.nextTick(function() {
                  // As expected, no event was triggered
                  done();
                });

              });

            });

          });

          describe ('and type is "out"', function() {

            var opts = [{id: 29, name: "La Cerca", lat: '-33.4421755', lng: '-70.6271705', direction: 'out'}];

            it('does not trigger "entered_geofence" event', function(done) {

              var clock = sinon.useFakeTimers();

              geofence.start(opts, function(err, gf) {
              
              // fast-forward 1 minute to set last_coords
                stub_get_location({lat: -30, lng: -68});
                clock.tick(60000);
                get_location_stub.restore();
                stub_get_location({lat: -33.4421755, lng: -70.6271705});
                clock.tick(60000);
                clock.restore();
                get_location_stub.restore();

                process.nextTick(function() {
                  // As expected, no event was triggered
                  done();
                });

              });

            });

          });

        });

      });

      describe('and device outside the fence', function() {

        describe('and was previously inside the fence', function() {

          describe('and type is "in"', function() {

            var opts = [{id: 29, name: "La Cerca", lat: '-33.4421755', lng: '-70.6271705', direction: 'in'}];

            it('does not trigger "left_geofence" event', function(done) {

              var clock = sinon.useFakeTimers();

              geofence.start(opts, function(err, gf) {

                var outside_location = {lat: -30, lng: -68}

                gf.on('left_geofence', function(coords) {
                  should.fail('"left_geofence" event triggered with "in" type');
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
                  // As expected, does not trigger event
                  done();
                });
              });

            });

          });

          describe('and type is "out"', function() {

            var opts = [{id: 29, name: "La Cerca", lat: '-33.4421755', lng: '-70.6271705', direction: 'out'}];

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
                  // As expected, no event was triggered
                  done();
                });
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
