var join = require('path').join,
  sinon = require('sinon'),
  helpers = require('./../../../../helpers'),
  should = require('should'),
  wifi_strat = helpers.load('providers/geo/strategies').wifi,
  location_response = require('../fixtures/wifi_location_response'),
  lib_path = helpers.lib_path(),
  api_path = join(lib_path, 'agent', 'plugins', 'control-panel', 'api'),
  keys = require(join(api_path, 'keys'));
  
describe('location', function () {
  before(function () {
    keys_get_stub = sinon.stub(keys, 'get').callsFake(() => {
      return { api: 'aaaaaaaaaa', device: 'bbbbbb' };
    });
  });

  after(function () {
    keys_get_stub.restore();
  });

  describe('when access points list return error', function () {
    var provider_stub = {},
      error = new Error('No access points found.');

    before(function () {
      provider_stub = helpers.stub_provider('access_points_list', error, null);
    });

    after(function () {
      provider_stub.restore();
    });

    it('returns error', function (done) {
      wifi_strat(function (err, res) {
        should(res).not.exist;
        err.should.exist;
        err.should.equal(error);
        done();
      });
    });
  });

  describe('when access points is valid', function () {
    var provider_stub = {};

    before(function () {
      var list = require('./../fixtures/parsed_access_points_list');
      provider_stub = helpers.stub_provider('access_points_list', null, list);
    });

    after(function () {
      provider_stub.restore();
    });

    describe('and geolocation endpoint returns error', function () {
      it('returns error', function () {});
    });

    describe('and geolocation endpoint returns 200 OK', function () {
      describe('and response is not valid', function () {
        before(function () {
          helpers.stub_request(
            'post',
            null,
            {},
            'Bad response',
            function (out) {
              args = out;
            }
          );
        });

        it('returns error', function (done) {
          wifi_strat(function (err, data) {
            should.exist(args.user_agent);
            args.user_agent.should.containEql('Prey/');
            err.should.be.an.instanceof(Error);
            should.not.exist(data);
            done();
          });
        });
      });

      describe('and response contains valid coordinates', function () {
        describe('and the body is a string', function () {
          beforeEach(function () {
            helpers.stub_request(
              'post',
              null,
              { statusCode: 200 },
              location_response,
              function (out) {
                args = out;
              }
            );
          });

          it('callsback coordinates', function (done) {
            wifi_strat(function (err, data) {
              should.exist(args.user_agent);
              args.user_agent.should.containEql('Prey/');
              should.not.exist(err);
              data.should.have.keys('lat', 'lng', 'accuracy', 'method');
              done();
            });
          });

          it('sets method to wifi', function (done) {
            wifi_strat(function (err, data) {
              data.method.should.equal('wifi');
              done();
            });
          });
        });

        describe('and the body is an object', function () {
          beforeEach(function () {
            helpers.stub_request(
              'post',
              null,
              { statusCode: 200 },
              JSON.parse(location_response),
              function (out) {
                args = out;
              }
            );
          });

          it('callsback coordinates', function (done) {
            wifi_strat(function (err, data) {
              should.exist(args.user_agent);
              args.user_agent.should.containEql('Prey/');
              should.not.exist(err);
              data.should.have.keys('lat', 'lng', 'accuracy', 'method');
              done();
            });
          });
        });
      });

      describe('real endpoint', function () {
        it('works', function (done) {
          provider_stub.restore();
          this.timeout(10000); // response may take longer

          wifi_strat(function (err, data) {
            done();
          });
        });
      });
    });
  });
});
