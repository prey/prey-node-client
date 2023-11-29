var sinon   = require('sinon'),
    should  = require('should'),
    api     = require('..'),
    api_req = require('../request');

var post_location  = api.devices.post_location; // shortcut

var stub_post = function(body, code) {
  return sinon.stub(api_req, 'post').callsFake((path, data, opts, cb) => {
    var resp = { statusCode: (code || 200), body: body };
    cb(null, resp, body);
  })
}

var data = { 
  lat: -33.3333333,
  lng: -70.0000000,
  accuracy: 50,
  method: 'wifi'
};

describe('post location', function() {
  
  describe('and api key or device key is not set', function() {
    
    before(function(){
      api.keys.unset('api');
      api.keys.unset('device');
    })

    after(function(){
      api.keys.set({ api: 'xxxxxxxxx', device: 'foobar' })
    })

    it('callsback an error', function() {
      post_location({ foo: 'bar'}, function(err) {
        should.exist(err);
        err.message.should.equal('Both API and Device keys are needed.');
      })
    })

  })

  describe('with no params', function() {

    it('callsback an error', function() {
      post_location(null, function(err) {
        err.should.be.a.error;
        err.message.should.containEql('Empty data');
      })
    })

  });

  describe('and the status code is 200', function() {

    before(function(){
      var body = data;
      stub = stub_post(body, 200);
    })

    after(function(){
      stub.restore();
    })

    it('callbacks true', function() {
      post_location(data, function(err, resp) {
        should.not.exist(err);
        should.equal(resp, true);
      })
    })
  })

  describe('and the status code is 201', function() {
    
    before(function(){
      var body = data;
      stub = stub_post(body, 201);
    })

    after(function(){
      stub.restore();
    })

    it('callbacks true', function() {
      post_location(data, function(err, resp) {
        should.not.exist(err);
        should.equal(resp, false);
      })
    })
  })

  describe('and the status code is 401', function() {

    before(function(){
      var body = data;
      stub = stub_post(body, 401);
    })

    after(function(){
      stub.restore();
    })

    it('callbacks true', function() {
      post_location(data, function(err, resp) {
        err.message.should.equal('Invalid credentials.');
      })
    })
  })
});