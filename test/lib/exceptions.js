var helpers    = require('../helpers'),
    sinon      = require('sinon'),
    should     = require('should'),
    needle     = require('needle'),
    exceptions = require(helpers.lib_path('exceptions'));

describe('exceptions.send', function() {
  
  before(function() {
    // for the tests to run, we need to make sure we will call post()
    delete process.env.TESTING;
  })

  after(function() {
    // once all tests are done, set the flag again.
    process.env.TESTING = '1';
  })

  describe('when TESTING flag is on', function() {

    // for this specific test we need the flag to exist
    before(function() {
      process.env.TESTING = '1';
    })

    // revert the change so other tests work
    after(function() {
      delete process.env.TESTING;
    })

    it('does not send any requests', function(done) {

      var spy = sinon.spy(needle, 'post');

      exceptions.send(new Error('Foobar'), function(err) {
        should.not.exist(err);
        spy.called.should.be.false;
        spy.restore()
        done();
      })

    })

  })

  describe('on failed request', function() {
    var stub2;
    before(function() {
      stub2 = helpers.stub_request('post', new Error('ENOENT'));
    })

    after(() => {
      stub2.restore();
    })

    it ('callsback an error', function(done) {

      exceptions.send(new Error('Foobar'), function(err) {

        err.should.be.a.Error;
        done();
      })

    })

  })

  describe('with no callback', function() {

    it('sends request', function() {
      var stub = sinon.stub(needle, 'post').callsFake(() => { /* noop */ });
      exceptions.send(new Error('Foobar'));
      stub.called.should.be.true;
      stub.restore()
    })


    it('does not fail', function() {
      (function() {
        var stub = sinon.stub(needle, 'post').callsFake(() => { /* noop */ });
        exceptions.send(new Error('Foobar'));
        stub.restore()
      }).should.not.throw();
    })

  })

})