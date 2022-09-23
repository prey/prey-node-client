var helpers          = require('./../../../helpers'),
    tmpdir           = require('os').tmpdir,
    should           = require('should'),
    sinon            = require('sinon'),
    join             = require('path').join,
    hooks            = helpers.load('hooks'),
    lib_path         = helpers.lib_path(),
    triggers_path    = join(lib_path, 'agent', 'actions', 'triggers'),
    triggers         = require(triggers_path),
    api_path         = join(lib_path, 'agent', 'plugins', 'control-panel', 'api'),
    api              = require(api_path),
    request          = require(join(api_path, 'request')),
    push             = require(join(api_path, 'push')),
    keys             = require(join(api_path, 'keys')),
    commands         = require(join(lib_path, 'agent', 'commands')),
    actions          = require(join(lib_path, 'agent', 'actions')),
    storage          = require(join(lib_path, 'agent', 'utils', 'storage')),
    lp               = require(join(lib_path, 'agent', 'plugins', 'control-panel', 'long-polling')),
    dummy            = require('./fixtures/triggers_responses');

const { v4: uuidv4 } = require('uuid');
var id = uuidv4();

describe('triggers', () => {
  var keys_present_stub,
      keys_get_stub,
      post_stub,
      push_stub,
      actions_start_stub;

  before((done) => {
    
    keys.set({ api: 'xxxxxxxxx', device: 'foobar' })
    push_stub = sinon.stub(push, 'response').callsFake(() => { return; })
    post_stub = sinon.stub(request, 'post').callsFake(() => { return; })
    keys_get_stub = sinon.stub(keys, 'get').callsFake(() => { return { api: 'aaaaaaaaaa', device: 'bbbbbb' } })
    keys_present_stub = sinon.stub(keys, 'present').callsFake(() => { return true; })
    actions_start_stub = sinon.stub(actions, 'start').callsFake(() => { return true; })
    storage.init('triggers', tmpdir() + '/test.db', done);
  })

  after((done) => {
    post_stub.restore();
    push_stub.restore();
    keys_present_stub.restore();
    keys_get_stub.restore();
    actions_start_stub.restore();
    storage.do('clear', {type: 'triggers'}, () => {
      storage.erase(tmpdir() + '/test.db', done);
    });
  })

  describe('start', () => {

    describe('when the request fails', () => {
      var get_stub,
          spy_sync,
          spy_get_local,
          spy_activate;

      before(() => {
        get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => {
          return cb(new Error('Trigger request error'));
        })
      })

      after(() => {
        get_stub.restore();
      })

     describe('and triggers tables does not exists', () => {
        before((done) => {
          spy_sync = sinon.spy(triggers, 'sync');
          spy_get_local = sinon.spy(storage.storage_fns, 'all');
          triggers.start(id, {}, done)
        })
  
        after(() => {
          spy_sync.restore();
          spy_get_local.restore();
        });

        it('checks in the local db and the actions stops', (done) => {
          spy_get_local.calledOnce.should.be.true;
          spy_sync.called.should.be.false;
          done();
        });

      });

      describe('and triggers table exists', () => {

       describe('and when there is no data in the local database', () => {
          
          before((done) => {
            spy_sync = sinon.spy(triggers, 'sync');
            spy_get_local = sinon.spy(storage.storage_fns, 'all');
            spy_clear_local = sinon.spy(storage.storage_fns, 'clear');
            setTimeout(() => { triggers.start(id, {}, done) }, 500)
          })

          after(() => {
            spy_sync.restore();
            spy_get_local.restore();
            spy_clear_local.restore();
          })
          
          it('checks in the local database and action stops', (done) => {
            spy_get_local.calledOnce.should.be.true;
            spy_sync.calledOnce.should.be.true;
            spy_clear_local.calledOnce.should.be.true;
            done();
          })
        })

        describe('and local database has triggers data', () => {
          before((done) => {
            spy_activate = sinon.spy(triggers, 'activate');
            storage.do('set', {type: 'triggers', id: dummy.repeat_triggers[0].id, data: dummy.exact_triggers[0]}, (err) => {
              storage.do('set', {type: 'triggers', id: dummy.repeat_triggers[0].id, data: dummy.repeat_triggers[0]}, (err) => {
                setTimeout(() => {
                  triggers.start(id, {}, done);
                }, 2000)
              });
            })
          })

          after(() => {
            spy_activate.restore();
            triggers.cancel_all();
          })

          it('activates the stores triggers', () => {
            spy_activate.calledTwice.should.be.true;
          })
        })
      })
    });

    describe('when the request succeeds', () => {
      var get_stub,
          spy_clear_local;

      before(() => {
        spy_clear_local = sinon.spy(triggers, 'clear_triggers');
        spy_logger = sinon.spy(triggers.logger, 'warn');
      })

      after(() => {
        spy_clear_local.restore();
        spy_logger.restore();
      })
      
      describe('and the it has 0 triggers', () => {
        before((done) => {
          get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => { return cb(null, {body: []}); })
          storage.do('set', {type: 'triggers', id: dummy.exact_triggers[0].id, data: dummy.exact_triggers[0]}, (err) => {
            triggers.start(id, {}, done);
          });
        })

        after(() => {
          get_stub.restore();
        })

        it('call sync and deletes and cancel local triggers', (done) => {
          spy_clear_local.calledOnce.should.be.true;
          storage.do('all', {type: 'triggers'}, (err, obj) => {
            Object.keys(obj).length.should.be.equal(0)
            done();
          })
        })
      })

      describe('and has one or more trigger', () => {

        describe('and it has exact_time triggers', () => {
          var clock;
          before((done) => {
            get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => { return cb(null, { body: dummy.exact_triggers }); })
            spy_sync = sinon.spy(triggers, 'sync');
            spy_perform = sinon.spy(commands, 'perform');
            new_date = 1918330449000;
            setTimeout(() => { triggers.start(id, {}, done) }, 500)
            clock = sinon.useFakeTimers(new_date);


          })

          after(() => {
            clock.restore();
            spy_sync.restore();
            spy_perform.restore(); 
            get_stub.restore();
          })

          it('does not set up the trigger in the past', (done) => {
            clock.tick(300);
            spy_perform.notCalled.should.be.equal(true);
            spy_logger.calledOnce.should.be.equal(true);
            spy_logger.getCall(0).args[0].should.containEql('Cant set trigger into the past!');
            done();
          })

          it('executes the action at the right time', (done) => {
            clock.tick(1001);
            spy_perform.calledOnce.should.be.equal(true);
            spy_perform.getCall(0).args[0].target.should.be.equal('alert');
            spy_perform.getCall(0).args[0].options.trigger_id.should.exists;
            spy_perform.getCall(0).args[0].options.trigger_id.should.be.equal(105);
            done();
          })

          it('and waits for the delay and executes the action at the right time', (done) => {
            clock.tick(10000);
            spy_perform.getCall(1).args[0].target.should.be.equal('lock');
            spy_perform.getCall(1).args[0].options.trigger_id.should.exists;
            spy_perform.getCall(1).args[0].options.trigger_id.should.be.equal(106);
            spy_perform.getCall(2).args[0].target.should.be.equal('alarm');
            spy_perform.getCall(2).args[0].options.trigger_id.should.exists;
            spy_perform.getCall(2).args[0].options.trigger_id.should.be.equal(105);
            spy_perform.calledThrice.should.be.equal(true);
            done();
          })
        })

       describe('and it has repeat_time triggers', () => {
          var clock;

          before((done) => {
            get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => { return cb(null, { body: dummy.repeat_triggers }); })
            spy_sync = sinon.spy(triggers, 'sync');
            spy_perform = sinon.spy(commands, 'perform');
            test_time = 1560795900000;
            setTimeout(() => { triggers.start(id, {}, done) }, 500)
            clock = sinon.useFakeTimers(test_time);
          })

          after(() => {
            clock.restore();
            spy_sync.restore();
            spy_perform.restore(); 
            get_stub.restore();
          })

          it('execute the trigger weekly', (done) => {
            // Test trigger set to be executed Mondays and Thursdays at 14:25:10, until next Wednesday.
            // it should run this monday and thursday, and then next monday, stoppping on wednesday.
            var time = test_time;

            while(time < 1561680000000) {      // Every second for the next two weeks, until next friday
              time += 1000;
              clock.tick(1000);
            }
            spy_perform.calledThrice.should.be.equal(true);
            spy_perform.getCall(0).args[0].options.trigger_id.should.exists;
            spy_perform.getCall(0).args[0].options.trigger_id.should.be.equal(107);
            spy_perform.getCall(1).args[0].options.trigger_id.should.be.equal(107);
            spy_perform.getCall(2).args[0].options.trigger_id.should.be.equal(107);

            spy_logger.calledTwice.should.be.equal(true);
            spy_logger.getCall(1).args[0].should.containEql("Invalid trigger format");
            done();
          });

        })

        describe('and it has event triggers', () => {
          var clock;

          before((done) => {
            get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => { return cb(null, { body: dummy.event_triggers }); })
            spy_sync = sinon.spy(triggers, 'sync');
            spy_perform = sinon.spy(commands, 'perform');
            new_date = 1561381200000;
            setTimeout(() => { triggers.start(id, {}, done) }, 500)
            clock = sinon.useFakeTimers(new_date);
            last_stub = sinon.stub(lp, 'last_connection').callsFake(() => {
              return 1461381200;  // unix time in seconds
            });
          })

          after((done) => {
            spy_sync.restore();
            spy_perform.restore(); 
            get_stub.restore();
            clock.restore();
            spy_logger.restore();
            done();
          })

          it('execute the actions when the event is triggered and not into the range', (done) => {
            hooks.trigger('new_location');
            hooks.trigger('disconnected');
            clock.tick(1000);
            spy_perform.getCall(0).args[0].target.should.be.equal('lock');
            spy_perform.getCall(0).args[0].options.trigger_id.should.be.equal(109);
            spy_perform.getCall(1).args[0].target.should.be.equal('alert');
            spy_perform.getCall(1).args[0].options.trigger_id.should.be.equal(108);
            spy_perform.calledTwice.should.be.equal(true);
            done();
          })

          it('execute the actions when the event is triggered and into the range', (done) => {
            clock.tick(1000 * 60 * 60 * 24 * 5); // Moving to Saturday
            hooks.trigger('new_location');
            clock.tick(1000);
            spy_perform.getCall(2).args[0].target.should.be.equal('alert');
            spy_perform.getCall(2).args[0].options.trigger_id.should.be.equal(108);
            spy_perform.getCall(3).args[0].target.should.be.equal('alarm');
            spy_perform.getCall(3).args[0].options.trigger_id.should.be.equal(110);
            spy_perform.callCount.should.be.equal(4);
            done();
          });

          it('execute the actions on events with id', (done) => {
            hooks.trigger('geofencing_in', {id: 666});
            clock.tick(500)
            hooks.trigger('geofencing_in', {id: 667});
            clock.tick(500)
            spy_perform.getCall(4).args[0].target.should.be.equal('alarm');
            spy_perform.getCall(4).args[0].options.trigger_id.should.be.equal(111);
            spy_perform.getCall(5).args[0].target.should.be.equal('lock');
            spy_perform.getCall(5).args[0].options.trigger_id.should.be.equal(112);
            spy_perform.callCount.should.be.equal(6); 
            done();
          });

          it('execute the actions when the event is triggered and into days the range', (done) => {
            clock.tick(1000 * 60 * 60 * 24) // One more Day
            hooks.trigger('stopped_charging');
            clock.tick(1000);
            spy_perform.getCall(6).args[0].target.should.be.equal('alert');
            spy_perform.getCall(6).args[0].options.trigger_id.should.be.equal(114);
            done();
          });

          it('execute with days and hours ranges', (done) => {
            clock.tick(1000 * 60 * 60 * 24) // One more Day
            hooks.trigger('mac_address_changed');
            clock.tick(1000)
            spy_perform.getCall(7).args[0].target.should.be.equal('lock');
            spy_perform.getCall(7).args[0].options.trigger_id.should.be.equal(115);
            done();
          });

          it('execute the actions on events with time', (done) => {
            hooks.trigger('device_unseen');
            clock.tick(500)
            spy_perform.getCall(8).args[0].target.should.be.equal('lock');
            spy_perform.getCall(8).args[0].options.trigger_id.should.be.equal(119);
            spy_perform.callCount.should.be.equal(9);
            done();
          });

          it('doesnt activate an unknown trigger event', (done) => {
            hooks.trigger('power_changed');
            spy_logger.calledThrice.should.be.equal(true);
            spy_logger.getCall(2).args[0].should.containEql("Unavailable event for Node Client.");
            spy_perform.callCount.should.be.equal(9);
            done();
          });

        })

      })


      describe('when the action triggers are persistent', () => {

        describe('and its an exact_time trigger', () => {
          var clock,
              spy_logger2;

          before((done) => {
            get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => { return cb(null, { body: dummy.persistent_triggers }); })
            spy_sync = sinon.spy(triggers, 'sync');
            spy_perform = sinon.spy(commands, 'perform');
            spy_logger2 = sinon.spy(triggers.logger, 'warn');
            new_date =  1576853705000;
            setTimeout(() => { triggers.start(id, {}, done) }, 500)
            clock = sinon.useFakeTimers(new_date);
          })

          after((done) => {
            clock.restore();
            spy_sync.restore();
            spy_perform.restore();
            get_stub.restore();
            spy_logger2.restore();
            setTimeout(() => {
              done();
            }, 2000);
          })

          it('executes the trigger for the past', (done) => {
            clock.tick(501);
            spy_perform.calledOnce.should.be.equal(true);
            spy_logger2.calledOnce.should.be.equal(true);
            spy_logger2.getCall(0).args[0].should.containEql('Persisting action for');
            done();
          })

           // it('does not executes again', (done) => {
          //   clock.tick(2000);
          //   triggers.start(id, {}, () => {
          //     clock.tick(500);
          //     spy_perform.notCalled.should.be.equal(true);
          //     done();
          //   })
          // })

        })
      })
    });

  });
});
