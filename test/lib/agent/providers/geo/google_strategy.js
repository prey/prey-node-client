var helpers = require('./../../../../helpers'),
    should = require('should'),
    google_strat = helpers.load('providers/geo/strategies').google,
    location_response = require('../fixtures/google_location_response'),
    link_response = require('../fixtures/location_link_response');

describe('location', function() {

  describe('when access points list return error', function() {

    var provider_stub = {},
        error = new Error('No access points found.');

    before(function() {
      provider_stub = helpers.stub_provider('access_points_list', error, null);
    });

    after(function() {
      provider_stub.restore();
    });

    it('returns error', function(done) {
      google_strat(function(err, res) {
        should(res).not.exist;
        err.should.exist;
        err.should.equal(error);
        done();
      });
    });

  });

  describe('when access points is valid', function() {

    var provider_stub = {};

    before(function() {
      var list = require('./../fixtures/parsed_access_points_list');
      provider_stub = helpers.stub_provider('access_points_list', null, list);
    });

    after(function() {
      provider_stub.restore();
    });

    describe('and geolocation endpoint returns error', function() {

      it('returns error', function() {

      });

    });

    describe('and geolocation endpoint returns 200 OK', function() {

      describe('and response is not valid', function() {

        before(function() {
          helpers.stub_request('post', null, {}, 'Bad response');
        });

        it('returns error', function(done) {

          google_strat(function(err, data) {
            err.should.be.an.instanceof(Error);
            should.not.exist(data);
            done();
          });

        });

      });

      describe('and response contains valid coordinates', function() {

        describe('and the body is a string', function() {

          beforeEach(function() {
            helpers.stub_request('post', null, { statusCode: 200 }, location_response);
          });


          it('callsback coordinates', function(done) {
            google_strat(function(err, data) {
              should.not.exist(err);
              data.should.have.keys(['lat', 'lng', 'accuracy', 'method']);
              done();
            });

          });

          it('sets method to wifi', function(done) {

            google_strat(function(err, data) {
              data.method.should.equal('wifi');
              done();
            });

          });

        });

        describe('and the body is an object', function() {

          beforeEach(function() {
            helpers.stub_request('post', null, { statusCode: 200 }, JSON.parse(location_response));
          });


          it('callsback coordinates', function(done) {
            google_strat(function(err, data) {
              should.not.exist(err);
              data.should.have.keys(['lat', 'lng', 'accuracy', 'method']);
              done();
            });

          });

        });

      });

      describe('real endpoint', function() {

        it('works', function(done) {
          provider_stub.restore();
          this.timeout(5000); // response may take longer

          google_strat(function(err, data) {
            if (err) {
              console.log('\n========================================');
              console.log(' Geolocation endpoint seems to be down!');
              console.log(' ' + err.message);
              console.log('========================================\n');
            }
            done();
          });

        });

      });

    });

  });

});