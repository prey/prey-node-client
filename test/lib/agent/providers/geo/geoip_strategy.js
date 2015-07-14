var helpers = require('./../../../../helpers'),
    should = require('should'),
    geoip_strat = helpers.load('providers/geo/strategies').geoip;

describe('geoip', function () {

  describe('with mocked location', function () {

    var stub_request = function(body) {
      helpers.stub_request('get', null, { statusCode: 200 }, body);
    }

    describe('when response', function () {

      var body = {};

      describe('has no body', function () {
        before(function() {
          stub_request(body);
        });

        it('returns error', function(done) {

          geoip_strat(function(err, res) {
            should(res).be.nil;
            should(err).be.instanceof.Error;
            err.message.should.be.exactly('Unable to get location from IP.');
            done();
          });

        });

      });

      describe('has body but no loc', function () {
        before(function () {
          body = {
            "ip": "8.8.8.8",
            "hostname": "google-public-dns-a.google.com",
            "org": "AS15169 Google Inc.",
            "city": "Mountain View",
            "region": "California",
            "country": "US",
            "phone": 650
          };

          stub_request(body);
        });

        it('returns error', function(done) {

          geoip_strat(function(err, res) {
            should(res).be.nil;
            should(err).be.instanceof.Error;
            err.message.should.be.exactly('Unable to get location from IP.');
            done();
          });

        });

      });

      describe('has body with loc', function () {

        beforeEach(function () {

          body = {
            "ip": "8.8.8.8",
            "hostname": "google-public-dns-a.google.com",
            "loc": "37.385999999999996,-122.0838",
            "org": "AS15169 Google Inc.",
            "city": "Mountain View",
            "region": "California",
            "country": "US",
            "phone": 650
          };

          stub_request(body);
        });

        it('returns location', function(done) {

          geoip_strat(function(err, res) {
            should(err).be.nil;
            res.lat.should.equal(37.385999999999996);
            res.lng.should.equal(-122.0838);
            done();
          });

        });

        it('returns method equals to geoip', function(done) {

          geoip_strat(function(err, res) {
            should(err).be.nil;
            res.method.should.equal('geoip');
            done();
          });

        });
      });

    });

  });

  describe('with real end-point', function() {

    it('returns location', function(done) {
      geoip_strat(function(err, res) {
        should(err).be.nil;
        should.exist(res.lat);
        should.exist(res.lng);
        should.exist(res.method);
        res.method.should.equal('geoip');
        done();
      });
    });

  });

});
