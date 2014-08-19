var fs       = require('fs'),
    join     = require('path').join,
    should   = require('should'),
    sinon    = require('sinon'),
    helpers  = require('./../../../helpers'),
    Emitter  = require('events').EventEmitter,
    push     = helpers.load('drivers/push'),
    mapper   = helpers.load('drivers/push/mapper'),
    entry    = require('entry'),
    needle   = require('needle');

var api      = require(helpers.root_path + '/lib/api'),
    common   = helpers.load('common'),
    hooks    = helpers.load('hooks');

describe('Push Driver', function(){

  var driver,
      stub,
      spy,
      api_stub,
      entry_stub,
      mapper_stub;

  var stub_entry = function(obj) {
    return sinon.stub(entry, 'mine', function(cb) {
      cb(obj);
    });
  }

  var stub_mapper = function(obj) {
    return sinon.stub(mapper, 'map', function(opts, cb) {
      cb(obj);
    });
  }

  before(function() {
    common.logger.off();

    common.config.set('device_key', 'foobar');

    api_stub = sinon.stub(api.push, 'data', function(data, opts, cb) {
      var resp = { statusCode: 200 }
      cb && cb(null, resp)
    });

    entry_stub = stub_entry(new Error('No workie.'))
    mapper_stub = stub_mapper(new Error('No workie.'))
  })

  after(function() {
    // common.logger.on();
    api_stub.restore();
    entry_stub.restore();
    mapper_stub.restore();
  })

  var load_it = function(cb) {
    driver = push.load({}, cb);
  }

  var unload_it = function(cb) {
    push.unload(cb);
  }

  describe('when loading', function() {

    it('it callsback an emitter', function(done) {
      load_it(function(err, emitter) {
        should.not.exist(err);
        emitter.should.be.an.instanceOf(Emitter);
        unload_it(done);
      })
    })

    it('checks port mapping', function() {

      entry_stub.reset();
      load_it(unload_it); // yes. this is inception all the way.
      entry_stub.calledOnce.should.be.true;
      entry_stub.reset();

    })

    describe('and find_mapping fails', function() {

      before(function() {
        push.unload(); // make sure is_mapping is false, so the stub is called
        // entry.mine is already stubbed above
      })

      after(function() {
        // stub.restore();
      })

      it('does not unload', function(done) {

        var unloaded = false;

        load_it(function(err, emitter) {
          emitter.once('unload', function() {
            unloaded = true;
          })

          process.nextTick(function() {
            unloaded.should.be.false;
            unload_it(done);
          })

          hooks.trigger('connected');
        })

      })

      it('attempts port mapping', function(done) {

        // already stubbed, so reset
        mapper_stub.restore();
        spy = sinon.stub(mapper, 'map', function(opts, cb) { cb(new Error('Ok mate')) });
        load_it(function(){ /* noop */ });

        process.nextTick(function() {
          spy.calledOnce.should.be.true;
          spy.restore();
          mapper_stub.reset();
          unload_it(done)
        });

      })

      describe('and port mapping fails', function() {

        var mapper_stub;

        before(function() {
          mapper_stub = sinon.stub(mapper, 'map', function(opts, cb) { return cb(new Error('Nope')) });
        })

        after(function() {
          mapper_stub.restore();
        })

        it('triggers an unreachable event', function(done) {

          spy = sinon.spy(hooks, 'trigger');
          load_it(function(){ /* noop */ });

          process.nextTick(function() {
            spy.calledWith('unreachable').should.be.true;
            unload_it(done)
          });

        })

      })

    })

    describe('and port finding succeeds', function() {

      var stubs = []

      before(function() {
        // push.unload(); // make sure is_mapping is false, so the stub is called

        entry_stub.restore();
        mapper_stub.restore();

        stubs.push(sinon.stub(entry, 'mine', function(cb) {
          var mapping = [{
            NewPortMappingDescription: 'Prey Anti-Theft',
            NewExternalPort: 54321
          }];

          return cb(null, mapping);
        }))

        stubs.push(sinon.stub(entry, 'public_ip', function(cb) {
          // set api key so scrambler works
          common.config.set('api_key', 'foobar');
          return cb(null, '123.123.123.123');
        }))

        stubs.push(sinon.stub(common.config, 'get', function() {
          return 'foobar'; // make sure we get a key for scrambler
        }))

        stubs.push(sinon.stub(mapper, 'public_ip', function(cb) {
          cb(null, '12.23.34.45');
        }))

      })

      after(function() {
        entry_stub.reset();
        mapper_stub.reset();
        stubs.forEach(function(s) { s.restore() });
      })

      it('notifies availability for push', function(done) {

        api_stub.reset()
        load_it(function(){ /* noop */ });

        process.nextTick(function() {
          api_stub.calledOnce.should.be.true;
          api_stub.args[0][0].should.have.keys('notification_id');
          unload_it();
          done()
        })

      })

      describe('and notify succeeds', function() {

        it('sets an IP check timer', function(done) {

          spy = sinon.spy(global, 'setInterval'); // playing with fire. i know.
          load_it(function(){ /* noop */ });

          process.nextTick(function() {
            spy.calledOnce.should.be.true;
            spy.args[0][1].should.equal(300000);
            spy.restore();
            unload_it(done);
          });

        })

        describe('and IP eventually changes', function() {

          it('should update notification ID')

        })

      })

      describe('and notify fails', function() {

        it('does not unload')

      })

    })

  })

  describe('after loaded', function() {

    // before(load_it)
    // after(unload_it)

    describe('and network status changes', function() {

      it('checks the mapping status')

    })

  })

})
