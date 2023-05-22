var helpers = require('./../../../../helpers'),
    should = require('should'),
    sinon = require('sinon'),
    join = require('path').join,
    lib_path = helpers.lib_path(),
    system = require(join(lib_path, 'common')).system,
    child_process = require('child_process'),
    geo_path = join(lib_path, 'agent', 'providers', 'geo'),
    geo = {
      darwin: require(join(geo_path, 'darwin')),
      linux: require(join(geo_path, 'linux')),
      win32: require(join(geo_path, 'win32')),
      win: require(join(geo_path, 'win32')),
    },
    geonative_strat = helpers.load('providers/geo/strategies').native;

describe('native geoloc', function () {

  var stub_get_location = function (platform, err, return_value) {
    var cb,
        stub = sinon.stub(geo[platform], 'get_location').callsFake((...args) => {
          cb = helpers.callback_from_args(args);
          cb(err, return_value);
        });

    return stub;
  }

  var successful_location = {
    win32: {
      lat: 38.707163,
      lng: -9.135517,
      accuracy: 140000.0
    },
    win: {
      lat: 38.707163,
      lng: -9.135517,
      accuracy: 140000.0
    },
    linux: {
      lat: 38.707163,
      lng: -9.135517,
      altitude: 140000.0
    },
    darwin: {
      lat: 38.707163,
      lng: -9.135517,
      accuracy: 140000.0,
      vertical_accuracy: 14000.0,
      altitude: 140000.0
    }
  };

  var stub;

  describe('geonative strategy', function() {

    var platform = process.platform;

    describe('on successful location', function() {

      before(function() {
        stub = stub_get_location(platform, null, successful_location[platform]);
      });

      after(function() {
        stub.restore();
      });

      it('returns location', function(done) {
        geonative_strat(function(err, res) {
          should(err).be.null;
          res.should.exist;
          res.lat.should.exist;
          res.lng.should.exist;
          res.method.should.equal('native');
          done();
        });
      });

    });

    describe('on error', function() {});

  });

  describe('win', function() {

    describe('when successful', function() {

      beforeEach(function() {
        stub = stub_get_location('win', null, successful_location.win);
      });

      afterEach(function() {
        stub.restore();
      });

      it('returns location', function(done) {
        geo.win.get_location(function(err, res) {
          should(err).be.null;
          res.should.be.equal(successful_location.win);
          done();
        });
      });

    });

  });

  describe('linux', function () {

    describe('when successful', function() {

      beforeEach(function() {
        stub = stub_get_location('linux', null, successful_location.linux);
      });

      afterEach(function() {
        stub.restore();
      });

      it('returns location', function(done) {
        geo.linux.get_location(function(err, res) {
          should(err).be.null;
          res.should.be.equal(successful_location.linux);
          done();
        });
      });


    });

  });

  describe('darwin', function() {

    describe('when successful', function() {

      beforeEach(function() {
        stub = stub_get_location('darwin', null, successful_location.darwin);
      });

      afterEach(function() {
        stub.restore();
      });

      it('returns location', function(done) {
        geo.darwin.get_location(function(err, res) {
          should(err).be.null;
          res.should.be.equal(successful_location.darwin);
          done();
        });
      });

    });

    describe('when Mac OS X version lower than 10.6', function() {

      var os_version_stub,
          os_version = "10.5.0";

      before(function() {
        os_version_stub = sinon.stub(system, 'get_os_version').callsFake(cb => {
          cb(null, os_version);
        });
      });

      after(function() {
        os_version_stub.restore();
      });

      it('returns error with "Not yet supported" message', function(done) {
        geo.darwin.get_location(function(err, res) {
          err.should.exist;
          err.message.should.equal('Not yet supported');
          done();
        });
      });

    });

  });

});
