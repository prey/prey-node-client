var helpers  = require('./../../../../helpers'),
    should   = require('should'),
    sinon    = require('sinon'),
    needle   = require('needle'),
    fs       = require('fs'),
    provider = helpers.load('providers/geo');

describe('geo', function() {

  var stub, req;


  describe('platform.get_location', function() {

    // we shuold eventually spec depending on browser version and stuff, but for the time 
    // being we'll just make sure that the whole thing works by calling the main entry function

    it('works', function(done) {

      // geoip uses needle to get the location data
      // so make a spy to ensure it doesn't get called
      var geoip = sinon.spy(needle, 'get');

      provider.get_location(function(err, res) {
        should.not.exist(err);
        res.lat.should.be.a.number;
        res.lng.should.be.a.number;

        geoip.called.should.be.false;
        geoip.restore();

        done();
      })
    })

  })

  describe('get_location (common for all OSs)', function() {

    describe('when native getter fails', function() {

      before(function() {
        var platform = helpers.load('providers/geo/' + process.platform);

        stub = sinon.stub(platform, 'get_location', function(cb) {
          cb(new Error('Foobar'));
        })
      })

      after(function() {
        stub.restore();
      })

      it('fallsback to geip', function(done) {

        req = sinon.stub(needle, 'get', function(url, cb) {
          cb(null, { statusCode: 200 })
        });

        provider.get_location(function(err, res) {
          req.called.should.be.true;
          req.restore();
          done();
        })

      })

    })

    describe('when native getter works', function() {

      before(function() {
        var platform = helpers.load('providers/geo/' + process.platform);

        stub = sinon.stub(platform, 'get_location', function(cb) {
          cb(null, { lat: 12.321, lng: 21.212 });
        })
      })

      after(function() {
        stub.restore();
      })


      it('returns valid coords', function(done) {

        provider.get_location(function(err, res) {
          should.not.exist(err);
          res.lat.should.eql(12.321);
          done();
        })
        
      })

      it('doesnt use geoip', function(done) {

        req = sinon.spy(needle, 'get');

        provider.get_location(function(err, res) {
          req.called.should.be.false;
          req.restore();
          done();
        })

      })

    })

  })

  describe('geoip', function() {

    // force geoip fallback by returning error from platform function

    before(function() {
      var platform = helpers.load('providers/geo/' + process.platform);

      stub = sinon.stub(platform, 'get_location', function(cb) {
        cb(new Error('Foobar'));
      })
    })

    after(function() {
      stub.restore();
    })

    describe('when receving an error', function() {

      before(function() {
        req = sinon.stub(needle, 'get', function(url, cb) {
          cb(new Error('Connection reset or something.'))
        });
      })

      after(function() {
        req.restore();
      })

      it('returns error', function(done) {

        provider.get_location(function(err, res) {
          err.should.be.a.Error;
          err.message.should.eql("Connection reset or something.");
          done();
        })

      })

    })

    describe('when receving an invalid response', function() {

      before(function() {
        req = sinon.stub(needle, 'get', function(url, cb) {
          cb(null, { statusCode: 200 }, "WOOF");
        });
      })

      after(function() {
        req.restore();
      })

      it('returns error', function(done) {

        provider.get_location(function(err, res) {
          err.should.be.a.Error;
          err.message.should.eql("Unable to get location from IP address.");
          done();
        })

      })
      
    })

    describe('when receving a valid response', function() {

      before(function() {

        var body = {
          "ip": "200.21.47.312",
          "country": "HQ",
          "loc": "-13.4500,-70.27"
        }

        req = sinon.stub(needle, 'get', function(url, cb) {
          cb(null, {}, body)
        });
      })

      after(function() {
        req.restore();
      })

      it('returns coords', function(done) {

        provider.get_location(function(err, res) {
          should.not.exist(err);
          res.lat.should.eql(-13.4500);
          res.lng.should.eql(-70.27);
          done();
        })

      })

    })

  })

});