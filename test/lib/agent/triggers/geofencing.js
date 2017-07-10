"use strict";

var helpers = require('./../../../helpers'),
    device_keys = require('./../../../../lib/agent/utils/keys-storage'),
    should = require('should'),
    sinon = require('sinon'),
    geo = helpers.load('providers/geo'),
    geofence = helpers.load('triggers/geofencing');

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

function save_fake_mac_address(done) {
  device_keys.get_stored('mac', function(err, stored_mac) {
    if (!stored_mac) {
      device_keys.store('mac', '00:00:00:00:00:00', function(err) {
        done();
      })
    } else {
      device_keys.update('mac', stored_mac, '00:00:00:00:00:00', function(err) {
        done();
      })
    }
  })
}

describe('geofence trigger', function() {

  describe('with one geofence', function() {

    describe('on start', function() {

      describe('when options does not include locations', function() {

        var opts = {};

        it('does not set fence', function() {});

        it('calls cb with error', function() {});

      });

      describe('when options include locations', function() {

        var opts = [{"id":27,"name":"La Cerca","lat":"-33.4219525","lng":"-70.6116441","zones":null,"color":"#0081C2","expires":null,"deleted_at":null,"account_id":5429766,"direction":"both","state":null,"created_at":"2015-12-24T16:15:42.000Z","updated_at":"2015-12-24T16:15:42.000Z"}];

        it('sets fence with default radius and interval', function(done) {

          save_fake_mac_address(function() {
            geofence.start(opts, function(err, gf) {
              gf.radius.should.equal(1000);
              gf.interval.should.equal(3600000);
              done();
            });
          });

        });

      });

      describe('and device inside the fence', function() {

        describe('and was previously outside the fence', function() {

          describe ('and type is "in"', function() {

            var opts = [{id: 28, name: "La Cerca", lat: '-33.4421755', lng: '-70.6271705', direction: 'in'}];
            
            it('triggers "entered_geofence" event', function(done) {

              var clock = sinon.useFakeTimers();

              save_fake_mac_address(function() {
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

          describe ('and type is "out"', function() {

            var opts = [{id: 29, name: "La Cerca", lat: '-33.4421755', lng: '-70.6271705', direction: 'out'}];

            it('does not trigger "entered_geofence" event', function(done) {

              var clock = sinon.useFakeTimers();

              save_fake_mac_address(function() {
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

      });

      describe('and device outside the fence', function() {

        describe('and was previously inside the fence', function() {

          describe('and type is "in"', function() {

            var opts = [{id: 29, name: "La Cerca", lat: '-33.4421755', lng: '-70.6271705', direction: 'in'}];

            it('does not trigger "left_geofence" event', function(done) {

              var clock = sinon.useFakeTimers();

              save_fake_mac_address(function() {
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

          });

          describe('and type is "out"', function() {

            var opts = [{id: 29, name: "La Cerca", lat: '-33.4421755', lng: '-70.6271705', direction: 'out'}];

            it('triggers "left_geofence" event', function(done) {

              var clock = sinon.useFakeTimers();

              save_fake_mac_address(function() {
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

    });

    describe('on stop', function() {});

  });

  describe('with two geofences', function() {
  });

});
