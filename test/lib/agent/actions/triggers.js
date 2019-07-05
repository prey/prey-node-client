var helpers          = require('./../../../helpers'),
    tmpdir           = require('os').tmpdir,
    should           = require('should'),
    sinon            = require('sinon'),
    join             = require('path').join,
    hooks            = helpers.load('hooks');
    lib_path         = helpers.lib_path(),
    triggers_path    = join(lib_path, 'agent', 'actions', 'triggers'),
    triggers         = require(triggers_path),
    api_path         = join(lib_path, 'agent', 'plugins', 'control-panel', 'api');
    api              = require(api_path);
    request          = require(join(api_path, 'request')),
    push             = require(join(api_path, 'push')),
    keys             = require(join(api_path, 'keys')),
    commands         = require(join(lib_path, 'agent', 'commands')),
    actions          = require(join(lib_path, 'agent', 'actions')),
    triggers_storage = require(join(triggers_path, 'storage')),
    storage          = require(join(lib_path, 'agent', 'utils', 'storage')),
    dummy            = require('./fixtures/triggers_responses');

describe('triggers', () => {
  var keys_present_stub,
      keys_get_stub,
      post_stub,
      push_stub,
      actions_start_stub;

  before((done) => {
    keys_present_stub = sinon.stub(keys, 'present').callsFake(() => { return true; })
    keys_get_stub = sinon.stub(keys, 'get').callsFake(() => { return { api: 'aaaaaaaaaa', device: 'bbbbbb' } })
    push_stub = sinon.stub(push, 'response').callsFake(() => { return; })
    post_stub = sinon.stub(request, 'post').callsFake(() => { return; })
    actions_start_stub = sinon.stub(actions, 'start').callsFake(() => { return true; })
    storage.init('triggers', tmpdir() + '/test.db', done)
  })

  after((done) => {
    keys_present_stub.restore();
    keys_get_stub.restore();
    post_stub.restore();
    push_stub.restore();
    actions_start_stub.restore();
    storage.close('triggers', () => {
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
          spy_get_local = sinon.spy(triggers_storage, 'get_triggers');
          triggers.start({}, done)
        })
  
        after(() => {
          spy_sync.restore();
          spy_get_local.restore();
        });

        it('chacks in the local db and the actions stops', (done) => {
          spy_get_local.calledOnce.should.be.true;
          spy_sync.called.should.be.false;
          done();
        });

      });

      describe('and triggers table exists', () => {

        describe('and when there is no data in the local database', () => {
          
          before((done) => {
            spy_sync = sinon.spy(triggers, 'sync');
            spy_get_local = sinon.spy(triggers_storage, 'get_triggers');
            spy_clear_local = sinon.spy(triggers_storage, 'clear_triggers');
            setTimeout(() => { triggers.start({}, done) }, 500)
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
            triggers_storage.store(dummy.exact_triggers[0], () => {
              triggers_storage.store(dummy.repeat_triggers[0], () => {
                triggers.start({}, done);
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
        spy_clear_local = sinon.spy(triggers_storage, 'clear_triggers');
      })

      after(() => {
        spy_clear_local.restore();
      })
      
      describe('and the it has 0 triggers', () => {
        before((done) => {
          get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => { return cb(null, {body: []}); })
          triggers_storage.store(dummy.exact_triggers[0], () => {
            triggers.start({}, done);
          });
        })

        after(() => {
          get_stub.restore();
        })

        it('call sync and deletes and cancel local triggers', (done) => {
          spy_clear_local.calledOnce.should.be.true;
          storage.all('triggers', (err, obj) => {
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
            date = new Date(),
            year = date.getFullYear() + 1,   // Always next year
            new_date = new Date(Date.UTC(year, 6, 25, 15, 00, 05));
            setTimeout(() => { triggers.start({}, done) }, 500)
            clock = sinon.useFakeTimers(new_date.getTime());
          })

          after(() => {
            clock.restore();
            spy_sync.restore();
            spy_perform.restore(); 
            get_stub.restore();
          })

          it('executes the action at the right time', (done) => {
            clock.tick(1500);
            spy_perform.getCall(0).args[0].target.should.be.equal('alert');
            spy_perform.calledOnce.should.be.equal(true);
            done();
          })

          it('and waits for the delay and executes the action at the right time', (done) => {
            clock.tick(10000);
            spy_perform.getCall(1).args[0].target.should.be.equal('lock');
            spy_perform.getCall(2).args[0].target.should.be.equal('alarm');
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
            setTimeout(() => { triggers.start({}, done) }, 500)
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

            done();

          });

        })

        describe('and it has event triggers', () => {
          var clock;

          before((done) => {
            get_stub = sinon.stub(request, 'get').callsFake((uri, opts, cb) => { return cb(null, { body: dummy.event_triggers }); })
            spy_sync = sinon.spy(triggers, 'sync');
            spy_perform = sinon.spy(commands, 'perform');
            setTimeout(() => { triggers.start({}, done) }, 500)
            clock = sinon.useFakeTimers(1561381200000);     // Monday 24/06/2019 13:00:00
          })

          after(() => {
            spy_sync.restore();
            spy_perform.restore(); 
            get_stub.restore();
            clock.restore();
          })

          it('execute the actions when the event is triggered and not into the range', (done) => {
            hooks.trigger('new_location');
            hooks.trigger('disconnected');
            clock.tick(1000)
            spy_perform.getCall(0).args[0].target.should.be.equal('lock');
            spy_perform.getCall(1).args[0].target.should.be.equal('alert');
            spy_perform.calledTwice.should.be.equal(true);
            done();
          })

          it('execute the actions when the event is triggered and into the range', (done) => {
            clock.tick(1000 * 60 * 60 * 24 * 5) // Moving to Saturday
            hooks.trigger('new_location');
            clock.tick(1000)
            spy_perform.getCall(2).args[0].target.should.be.equal('alert');
            spy_perform.getCall(3).args[0].target.should.be.equal('alarm');
            spy_perform.callCount.should.be.equal(4);
            done();
          });

          it('execute the actions on events with id', (done) => {
            hooks.trigger('geofencing_in', {id: 666});
            clock.tick(500)
            hooks.trigger('geofencing_in', {id: 667});
            clock.tick(500)
            spy_perform.getCall(4).args[0].target.should.be.equal('alarm');
            spy_perform.getCall(5).args[0].target.should.be.equal('lock');
            spy_perform.callCount.should.be.equal(6); 
            done();
          });

          it('execute the actions when the event is triggered and into days the range', (done) => {
            clock.tick(1000 * 60 * 60 * 24) // One more Day
            hooks.trigger('stopped_charging');
            clock.tick(1000)
            spy_perform.getCall(6).args[0].target.should.be.equal('alert');
            done();
          });

          it('execute with days and hours ranges', (done) => {
            clock.tick(1000 * 60 * 60 * 24) // One more Day
            hooks.trigger('mac_address_changed');
            clock.tick(1000)
            spy_perform.getCall(7).args[0].target.should.be.equal('lock');
            done();
          });

          it('doesnt activate an unknown trigger event', (done) => {
            hooks.trigger('power_changed');
            spy_perform.callCount.should.be.equal(8);
            done();
          });

        })

      })

    });

  });
});
