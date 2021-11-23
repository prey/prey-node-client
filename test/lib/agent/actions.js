var helpers  = require('./../../helpers'),
    should   = require('should'),
    sinon    = require('sinon'),
    actions  = helpers.load('actions'),
    Emitter  = require('events').EventEmitter,
    hooks    = require('./../../../lib/agent/hooks'),
    alarm    = require('./../../../lib/agent/actions/alarm'),
    alert    = require('./../../../lib/agent/actions/alert');

describe('actions', function(){

  describe('action start and stop', () => {
    var emitter = new Emitter(),
        hooks_spy,
        alarm_start_stub;

    before(() => {
      hooks_spy = sinon.stub(hooks, 'trigger');
      alarm_start_stub = sinon.stub(alarm, 'start').callsFake((id, options, cb) => { return cb(null, emitter); })
      alarm_stop_spy = sinon.stub(alarm, 'stop');
    })

    after(() => {
      alarm_start_stub.restore();
      hooks_spy.restore();
      alarm_stop_spy.restore();
    })

    it('runs the action and then stop it', (done) => {
      actions.start('1234-5678', 'alarm', {sound: 'modem'});
      setTimeout(() => {
        hooks_spy.calledOnce.should.be.equal(true);
        hooks_spy.getCall(0).args[0].should.be.equal('action');
        hooks_spy.getCall(0).args[1].should.be.equal('started');
        hooks_spy.getCall(0).args[2].should.be.equal('1234-5678');
        hooks_spy.getCall(0).args[3].should.be.equal('alarm');

        setTimeout(() => {
          actions.stop('1234-5678');
          alarm_stop_spy.calledOnce.should.be.equal(true);
          done();
        }, 1000)
      }, 500)
    })
  });

  describe('action start with options loops 5 and secondsbetween 0', () => {
    var emitter = new Emitter(),
        hooks_spy,
        alarm_start_stub;

    before(() => {
      hooks_spy = sinon.stub(hooks, 'trigger');
      alarm_start_stub = sinon.stub(alarm, 'start').callsFake((id, options, cb) => { return cb(null, emitter); })
      alarm_stop_spy = sinon.stub(alarm, 'stop');
    })

    after(() => {
      alarm_start_stub.restore();
      hooks_spy.restore();
      alarm_stop_spy.restore();
    })

    it('runs the action and alarm sound 5 times', (done) => {
      let alarmStart = actions.start('4321-9876', 'alarm', {sound: 'modem', loops: 5, secondsbetween: 0 });
      setTimeout(() => {
        alarmStart.loops.should.be.equal(4);
        hooks_spy.calledOnce.should.be.equal(true);
        hooks_spy.getCall(0).args[0].should.be.equal('action');
        hooks_spy.getCall(0).args[1].should.be.equal('started');
        hooks_spy.getCall(0).args[2].should.be.equal('4321-9876');
        hooks_spy.getCall(0).args[3].should.be.equal('alarm');
        setTimeout(() => {
          alarmStart.loops.should.be.equal(3);
          setTimeout(() => {
            alarmStart.loops.should.be.equal(2);
            setTimeout(() => {
              alarmStart.loops.should.be.equal(1);
              setTimeout(() => {
                alarmStart.loops.should.be.equal(0);
                actions.stop('4321-9876');
                alarm_stop_spy.calledOnce.should.be.equal(true);
                done();
              }, 30 * 1000);
            }, 30 * 1000);
          }, 30 * 1000);
        }, 30 * 1000);
      }, 1000);
    })
  });

  describe('action start with options loops 5 and secondsbetween 5', () => {
    var emitter = new Emitter(),
        hooks_spy,
        alarm_start_stub;

    before(() => {
      hooks_spy = sinon.stub(hooks, 'trigger');
      alarm_start_stub = sinon.stub(alarm, 'start').callsFake((id, options, cb) => { return cb(null, emitter); })
      alarm_stop_spy = sinon.stub(alarm, 'stop');
    })

    after(() => {
      alarm_start_stub.restore();
      hooks_spy.restore();
      alarm_stop_spy.restore();
    })

    it('runs the action and alarm sound 5 times and wait 5 seconds between each call', (done) => {
      let alarmStart = actions.start('1342-9487', 'alarm', {sound: 'modem', loops: 5, secondsbetween: 5 });
      setTimeout(() => {
        alarmStart.loops.should.be.equal(4);
        hooks_spy.calledOnce.should.be.equal(true);
        hooks_spy.getCall(0).args[0].should.be.equal('action');
        hooks_spy.getCall(0).args[1].should.be.equal('started');
        hooks_spy.getCall(0).args[2].should.be.equal('1342-9487');
        hooks_spy.getCall(0).args[3].should.be.equal('alarm');
        setTimeout(() => {
          alarmStart.loops.should.be.equal(3);
          setTimeout(() => {
            alarmStart.loops.should.be.equal(2);
            setTimeout(() => {
              alarmStart.loops.should.be.equal(1);
              setTimeout(() => {
                alarmStart.loops.should.be.equal(0);
                actions.stop('1342-9487');
                alarm_stop_spy.calledOnce.should.be.equal(true);
                done();
              }, 30 * 1000 + 5 * 1000);
            }, 30 * 1000 + 5 * 1000);
          }, 30 * 1000 + 5 * 1000);
        }, 30 * 1000 + 5 * 1000);
      }, 1000);
    })
  });

  describe('when an action with same id arrives', () => {
    var emitter = new Emitter(),
        hooks_spy2,
        alarm_start_stub;

    before(() => {
      hooks_spy2 = sinon.stub(hooks, 'trigger');
      alarm_start_stub = sinon.stub(alarm, 'start').callsFake((id, options, cb) => { return cb(null, emitter); })
      alarm_stop_spy = sinon.stub(alarm, 'stop');
    })

    after(() => {
      alarm_start_stub.restore();
      hooks_spy2.restore();
      alarm_stop_spy.restore();
    })

    it('throws an error', (done) => {
      actions.start('9876-5432', 'alarm', {sound: 'modem'});
      setTimeout(() => {
        hooks_spy2.calledOnce.should.be.equal(true);
        hooks_spy2.getCall(0).args[0].should.be.equal('action');
        hooks_spy2.getCall(0).args[1].should.be.equal('started');
        hooks_spy2.getCall(0).args[2].should.be.equal('9876-5432');
        hooks_spy2.getCall(0).args[3].should.be.equal('alarm');

        setTimeout(() => {
          actions.start('9876-5432', 'alarm', {sound: 'modem'}, (err) => {
            should.exist(err);
            err.message.should.containEql('Already running');

            actions.stop('9876-5432');
            alarm_stop_spy.calledOnce.should.be.equal(true);
            done();
          })
        }, 1000)
      }, 500)
    })
  })

  describe('when an action with different id but same name arrives', () => {
    var emitter1 = new Emitter(),
        emitter2 = new Emitter(),
        hooks_spy,
        alarm_start_stub,
        alert_start_stub;

    before(() => {
      hooks_spy = sinon.stub(hooks, 'trigger');
      alarm_start_stub = sinon.stub(alarm, 'start').callsFake((id, options, cb) => { return cb(null, emitter1); })
      alert_start_stub = sinon.stub(alert, 'start').callsFake((id, options, cb) => { return cb(null, emitter2); })
      alarm_stop_spy = sinon.stub(alarm, 'stop');
      alert_stop_spy = sinon.stub(alert, 'stop');
    })

    after(() => {
      alarm_start_stub.restore();
      alert_start_stub.restore();
      hooks_spy.restore();
      alarm_stop_spy.restore();
      alert_stop_spy.restore();
    })


    it('throws an error', (done) => {
      actions.start('1234-5678', 'alarm', {sound: 'modem'})
      actions.start('xxxx-yyyy', 'alert', {message: 'hey!'})
      setTimeout(() => {
        hooks_spy.calledTwice.should.be.equal(true);
        hooks_spy.getCall(0).args[0].should.be.equal('action');
        hooks_spy.getCall(0).args[1].should.be.equal('started');
        hooks_spy.getCall(0).args[2].should.be.equal('1234-5678');
        hooks_spy.getCall(0).args[3].should.be.equal('alarm');
        hooks_spy.getCall(1).args[0].should.be.equal('action');
        hooks_spy.getCall(1).args[1].should.be.equal('started');
        hooks_spy.getCall(1).args[2].should.be.equal('xxxx-yyyy');
        hooks_spy.getCall(1).args[3].should.be.equal('alert');

        setTimeout(() => {
          actions.start('xxxx-zzzz', 'alert', {sound: 'alarm'}, (err) => {
            should.exist(err);
            err.message.should.containEql('Already running');

            actions.stop('1234-5678');
            alarm_stop_spy.calledOnce.should.be.equal(true);

            setTimeout(() => {
              actions.stop('xxxx-yyyy');
              alert_stop_spy.calledOnce.should.be.equal(true);
              done();
            }, 1000)
          })
        }, 1000)
      }, 500)

    })

  })

  describe('when multiple actions are started', function(){

    it('launches them', function(){

    });

    describe('and one of them returns', function(){


    });

    describe('and all of them return', function(){

      it('triggers an actions_finished event', function(){



      });

    });

  })

  describe('when an action is started', function(){

    describe('and the module is present', function(){

      describe('and exports a start() function', function(){

        it('calls it', function(){

        });

        describe('and it finishes', function(){

          it('triggers an [action_name]_finished event', function(){

          });

        });

      });

      describe('and does not export a start() function', function(){

        it('does not throw an error', function(){

        });

      });

    });

    describe('and the module is not present', function(){

      it('does not throw an error', function(){

      });

    });

  });

  describe('when an action is stopped', function(){

    describe('and the module exports a stop() function', function(){

      it('calls it', function(){


      });

    });

    describe('and the module does not export a stop() function', function(){

      it('does not throw an error', function(){

      });

    });

  });

});
