var fs       = require('fs'),
    join     = require('path').join,
    should   = require('should'),
    sinon    = require('sinon'),
    helpers  = require('./../../../helpers'),
    Emitter  = require('events').EventEmitter,
    push     = helpers.load('drivers/push'),
    entry    = require('entry'),
    needle   = require('needle');

var common   = helpers.load('common'),
    hooks    = helpers.load('hooks');

common.logger.off(); // THANK YOU.

describe('Push Driver', function(){
  
  var driver,
      stub, 
      spy;
  
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

      spy = sinon.spy(entry, 'mine');
      load_it(unload_it); // yes. this is inception all the way.
      spy.calledOnce.should.be.true;
      spy.restore();

    })
    
    describe('and port mapping fails', function() {
      
      before(function() {
        push.unload(); // make sure is_mapping is false, so the stub is called

        stub = sinon.stub(entry, 'mine', function(cb) {
          return cb(new Error('Unable to map.'))
        })
      })
      
      after(function() {
        stub.restore();
      })

      it('triggers unreachable hook', function(done) {

        spy = sinon.spy(hooks, 'trigger');
        load_it(function(){ /* noop */ });

        process.nextTick(function() {
          spy.calledWith('unreachable').should.be.true;
          unload_it(done)
        });

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

    })
    
    describe('and port mapping succeeds', function() {

      var stub2, stub3;
      var api = require(helpers.root_path + '/lib/api');

      before(function() {
        // push.unload(); // make sure is_mapping is false, so the stub is called

        stub = sinon.stub(entry, 'mine', function(cb) {
          var mapping = [ { 
            NewPortMappingDescription: 'Prey Anti-Theft', 
            NewExternalPort: 54321 
          } ];
          return cb(null, mapping);
        })

        stub2 = sinon.stub(entry, 'public_ip', function(cb) {
          return cb(null, '123.123.123.123');
        })

        stub3 = sinon.stub(api.push, 'data', function(data, opts, cb) { 
          var resp = { statusCode: 200 }
          cb && cb(null, resp) 
        });
      })
      
      after(function() {
        stub.restore();
        stub2.restore();
        stub3.restore();
      })
      
      it('notifies availability for push', function(done) {

        load_it(function(){ /* noop */ });

        process.nextTick(function() {
          stub3.calledOnce.should.be.true;
          stub3.args[0][0].should.have.keys('notification_id');
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