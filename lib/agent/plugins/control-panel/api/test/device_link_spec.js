var sinon   = require('sinon'),
    should  = require('should'),
    api     = require('..'),
    api_req = require('../request');

var link  = api.devices.link; // shortcut

var stub_post = function(body, code) {
  return sinon.stub(api_req, 'post', function(path, data, opts, cb) {
    var resp = { statusCode: (code || 200), body: body };
    cb(null, resp, body);
  })
}

describe('link device', function() {

  before(function(){
    api.keys.unset('api');
    api.keys.unset('device');
  })

  describe('with no params', function(){

    it('callsback an error', function() {
      link(null, function(err) {
        err.should.be.a.error;
        err.message.should.containEql('Empty data');
      })
    })

  })

  describe('and api key is not set', function(){

    before(function(){
      api.keys.unset('api');
      api.keys.unset('device');
    })

    it('callsback an error', function() {
      link({ foo: 'bar'}, function(err) {
        should.exist(err);
        err.code.should.equal('NO_API_KEY');
      })
    })

  })

  describe('and device key is already set', function(){

    before(function(){
      api.keys.set({ api: 'xxxxxxxxx', device: 'foobar' })
    })

    it('callsback an error', function() {
      link({ foo: 'bar'}, function(err) {
        should.exist(err);
        err.code.should.equal('DEVICE_KEY_SET');
      })
    })

  })

  describe('and device key is not set', function() {
    
    var stub;

    beforeEach(function(){
      api.keys.unset('device'); // otherwise next test fails
    })
    
    describe('with invalid credentials', function() {

      before(function(){
        stub = stub_post('Invalid credentials.', 401);
      })

      after(function(){
        stub.restore();
      })
      
      it('callsback an error', function(done) {
        link({ name: 'bar'}, function(err) {
          err.should.exist;
          err.code.should.equal('INVALID_CREDENTIALS');
          done()
        })
      })
      
    })
    
    describe('with valid credentials', function() {
      
      before(function() {
        // this is just so we don't get a NO_API_KEY error
        // the real work is done by stubbing the POST request
        api.keys.set({ api: 'valid' });
      })

      describe('and valid params', function() {

        var stub,
            key     = 'aaabbb',
            params  = {
              name: 'device',
              type: 'Laptop',
              os:   'Windows'
            };

        describe('and failed response', function() {

          before(function(){
            var body = 'PICOPALQUELEE';
            stub = stub_post(body, 422);
          })

          after(function(){
            stub.restore();
          })

          it('callbacks error', function(done){

            link(params, function(err, key) {
              should.exist(err);
              err.code.should.equal('UNPROCESSABLE_DATA');
              done();
            })
          })

          it('sets nothing', function(done){
            var spy = sinon.spy(api.keys, 'set');

            link(params, function(err, res) {
              should.exist(err);
              should.not.exist(res);
              spy.called.should.be.false;
              spy.restore();
              done();
            })
          })

        })

        describe('and valid response', function(){

          before(function(){
            var body = { key: key };
            stub = stub_post(body, 200);
          })

          after(function(){
            stub.restore();
          })

          it('returns key', function(done){
            link(params, function(err, res) {
              should.not.exist(err);
              res.should.equal(key);
              done();
            })
          })

          it('sets key internally', function(done){
            var spy = sinon.spy(api.keys, 'set');

            link(params, function(err, res) {
              should.not.exist(err);
              spy.calledWith({ device: key }).should.be.true;
              spy.restore();
              done();
            })

          })

        })

      })

    })

  })

})
