var helpers = require('./../../../../helpers'),
    should = require('should'),
    sinon = require('sinon'),
    join = require('path').join,
    lib_path = helpers.lib_path,
    geo_path = join(lib_path, 'agent', 'providers', 'geo'),
    geo = {
      darwin: require(join(geo_path, 'darwin')),
      linux: require(join(geo_path, 'linux')),
      win: require(join(geo_path, 'win32')),
    },
    geonative_strat = helpers.load('providers/geo/strategies').native;

describe('native geoloc', function () {

  var stub_get_location = function (platform, err, return_value) {
    var cb,
        stub = sinon.stub(geo[platform], 'get_location', function() {
          cb = helpers.callback_from_args(arguments);
          cb(err, return_value);
        });

    return stub;
  }

  var successful_location = {
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
          res.method.should.equal('geonative');
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

    var succesful_location = 
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

  });

});
