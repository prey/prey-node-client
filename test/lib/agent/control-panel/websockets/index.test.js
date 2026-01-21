/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const rewire = require('rewire');
const sinon = require('sinon');
const { expect } = require('chai');
const { EventEmitter } = require('events');

describe('WebSocket index.js', () => {
  let websocketsRewired;
  let mockWs;
  let mockHooks;
  let mockStorage;
  let mockLogger;

  beforeEach(() => {
    websocketsRewired = rewire('../../../../../lib/agent/control-panel/websockets');

    // Mock WebSocket
    mockWs = {
      readyState: 1,
      send: sinon.stub(),
      ping: sinon.stub().callsFake((data, cb) => cb && cb()),
      pong: sinon.stub(),
      terminate: sinon.stub(),
      on: sinon.stub(),
    };

    // Mock hooks
    mockHooks = {
      trigger: sinon.stub(),
      on: sinon.stub(),
      remove: sinon.stub(),
    };

    // Mock storage
    mockStorage = {
      do: sinon.stub().callsFake((action, opts, cb) => {
        if (cb) cb(null, []);
      }),
    };

    // Mock logger
    mockLogger = {
      info: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
    };

    // Inject mocks
    websocketsRewired.__set__('ws', mockWs);
    websocketsRewired.__set__('hooks', mockHooks);
    websocketsRewired.__set__('storage', mockStorage);
    websocketsRewired.__set__('logger', mockLogger);
  });

  afterEach(() => {
    sinon.restore();
    websocketsRewired.resetReconnectDelay();
    websocketsRewired.responses_queue = [];
    websocketsRewired.responsesAck = [];
  });

  // ==================== Queue Management Tests ====================
  describe('Queue Management', () => {
    describe('responses_queue', () => {
      it('should be an array', () => {
        expect(websocketsRewired.responses_queue).to.be.an('array');
      });

      it('should be empty initially', () => {
        expect(websocketsRewired.responses_queue).to.have.length(0);
      });
    });

    describe('responsesAck', () => {
      it('should be an array', () => {
        expect(websocketsRewired.responsesAck).to.be.an('array');
      });

      it('should be empty initially', () => {
        expect(websocketsRewired.responsesAck).to.have.length(0);
      });
    });

    describe('retryQueuedResponses', () => {
      it('should do nothing when queue is empty', () => {
        websocketsRewired.responses_queue = [];
        const retryQueuedResponses = websocketsRewired.__get__('retryQueuedResponses');
        retryQueuedResponses();
        expect(websocketsRewired.responses_queue).to.have.length(0);
      });

      it('should retry queued responses', () => {
        const notifyActionStub = sinon.stub(websocketsRewired, 'notify_action');
        websocketsRewired.responses_queue = [{
          body: { status: 'started', target: 'lock' },
          reply_id: '123',
          opts: null,
          error: null,
          out: null,
          time: new Date().toISOString(),
          id: 'resp-1',
          retries: 0,
        }];

        const retryQueuedResponses = websocketsRewired.__get__('retryQueuedResponses');
        retryQueuedResponses();

        expect(notifyActionStub.calledOnce).to.be.true;
        notifyActionStub.restore();
      });
    });

    describe('retryAckResponses', () => {
      it('should do nothing when ack queue is empty', () => {
        websocketsRewired.responsesAck = [];
        const retryAckResponses = websocketsRewired.__get__('retryAckResponses');
        retryAckResponses();
        expect(websocketsRewired.responsesAck).to.have.length(0);
      });

      it('should retry ack responses', () => {
        const notifyAckStub = sinon.stub(websocketsRewired, 'notifyAck');
        websocketsRewired.responsesAck = [{
          ack_id: 'ack-123',
          type: 'ack',
          id: 'cmd-1',
          sent: false,
          retries: 0,
        }];

        const retryAckResponses = websocketsRewired.__get__('retryAckResponses');
        retryAckResponses();

        expect(notifyAckStub.calledOnce).to.be.true;
        notifyAckStub.restore();
      });
    });
  });

  // ==================== ACK Functions Tests ====================
  describe('ACK Functions', () => {
    describe('removeAckFromArray', () => {
      it('should remove ack by ack_id', () => {
        websocketsRewired.responsesAck = [
          { ack_id: 'ack-1', type: 'ack' },
          { ack_id: 'ack-2', type: 'ack' },
        ];

        const removeAckFromArray = websocketsRewired.__get__('removeAckFromArray');
        removeAckFromArray('ack-1');

        expect(websocketsRewired.responsesAck).to.have.length(1);
        expect(websocketsRewired.responsesAck[0].ack_id).to.equal('ack-2');
      });

      it('should do nothing if ack_id not found', () => {
        websocketsRewired.responsesAck = [{ ack_id: 'ack-1', type: 'ack' }];

        const removeAckFromArray = websocketsRewired.__get__('removeAckFromArray');
        removeAckFromArray('ack-999');

        expect(websocketsRewired.responsesAck).to.have.length(1);
      });
    });

    describe('setValueRetriesToJsonInAckArray', () => {
      it('should increment retries for matching ack_id', () => {
        websocketsRewired.responsesAck = [
          { ack_id: 'ack-1', retries: 0 },
          { ack_id: 'ack-2', retries: 1 },
        ];

        const setValueRetriesToJsonInAckArray = websocketsRewired.__get__('setValueRetriesToJsonInAckArray');
        setValueRetriesToJsonInAckArray('ack-1');

        expect(websocketsRewired.responsesAck[0].retries).to.equal(1);
        expect(websocketsRewired.responsesAck[1].retries).to.equal(1);
      });

      it('should do nothing if ack_id not found', () => {
        websocketsRewired.responsesAck = [{ ack_id: 'ack-1', retries: 0 }];

        const setValueRetriesToJsonInAckArray = websocketsRewired.__get__('setValueRetriesToJsonInAckArray');
        setValueRetriesToJsonInAckArray('ack-999');

        expect(websocketsRewired.responsesAck[0].retries).to.equal(0);
      });
    });

    describe('sendAckToServer', () => {
      it('should send ack when ws is ready', () => {
        websocketsRewired.responsesAck = [{ ack_id: 'ack-1', type: 'ack', sent: false }];
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.sendAckToServer({ ack_id: 'ack-1', type: 'ack' });

        expect(mockWs.send.calledOnce).to.be.true;
        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.ack_id).to.equal('ack-1');
        expect(sentData.type).to.equal('ack');
      });

      it('should not send when ws is not ready', () => {
        websocketsRewired.__set__('ws', null);

        websocketsRewired.sendAckToServer({ ack_id: 'ack-1', type: 'ack' });

        expect(mockWs.send.called).to.be.false;
      });

      it('should not send when ws readyState is not 1', () => {
        mockWs.readyState = 0;
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.sendAckToServer({ ack_id: 'ack-1', type: 'ack' });

        expect(mockWs.send.called).to.be.false;
      });
    });

    describe('notifyAck', () => {
      it('should remove ack when retries exceed max', () => {
        websocketsRewired.responsesAck = [{ ack_id: 'ack-1', type: 'ack', retries: 4 }];

        websocketsRewired.notifyAck('ack-1', 'ack', '', false, 4);

        expect(websocketsRewired.responsesAck).to.have.length(0);
      });

      it('should send ack when found by id and not sent', () => {
        const sendAckStub = sinon.stub(websocketsRewired, 'sendAckToServer');
        websocketsRewired.responsesAck = [{
          ack_id: 'ack-1',
          type: 'ack',
          id: 'cmd-1',
          sent: false,
          retries: 0,
        }];

        websocketsRewired.notifyAck('ack-1', 'ack', 'cmd-1', false, 0);

        expect(sendAckStub.calledOnce).to.be.true;
        sendAckStub.restore();
      });
    });
  });

  // ==================== Heartbeat Tests ====================
  describe('Heartbeat Functions', () => {
    describe('heartbeat', () => {
      it('should trigger device_unseen and restart when ws is not ready', () => {
        websocketsRewired.__set__('ws', null);
        websocketsRewired.__set__('hooks', mockHooks);

        websocketsRewired.heartbeat();

        expect(mockHooks.trigger.calledWith('device_unseen')).to.be.true;
      });

      it('should trigger reconnection when readyState is not 1', () => {
        mockWs.readyState = 3; // CLOSED
        websocketsRewired.__set__('ws', mockWs);
        websocketsRewired.__set__('hooks', mockHooks);

        websocketsRewired.heartbeat();

        expect(mockHooks.trigger.calledWith('device_unseen')).to.be.true;
      });
    });

    describe('heartbeatTimed', () => {
      let clock;

      beforeEach(() => {
        clock = sinon.useFakeTimers();
      });

      afterEach(() => {
        clock.restore();
      });

      it('should set timeout for heartbeat', () => {
        websocketsRewired.heartbeatTimed();

        // Verify timeout was set (it's internal, so we check side effects)
        const pingTimeout = websocketsRewired.__get__('pingTimeout');
        expect(pingTimeout).to.not.be.null;
      });
    });
  });

  // ==================== Notification Functions Tests ====================
  describe('Notification Functions', () => {
    describe('notify_status', () => {
      it('should send status when ws is ready', () => {
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.notify_status({ online: true });

        expect(mockWs.send.calledOnce).to.be.true;
        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.type).to.equal('device_status');
        expect(sentData.body.online).to.equal(true);
      });

      it('should not send when ws is not ready', () => {
        websocketsRewired.__set__('ws', null);

        websocketsRewired.notify_status({ online: true });

        expect(mockWs.send.called).to.be.false;
      });

      it('should include id, type, time and body in message', () => {
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.notify_status({ cpu: 50 });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData).to.have.property('id');
        expect(sentData).to.have.property('type');
        expect(sentData).to.have.property('time');
        expect(sentData).to.have.property('body');
      });
    });

    describe('notify_action', () => {
      it('should not send when id is missing', () => {
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.notify_action('started', null, 'lock');

        expect(mockWs.send.called).to.be.false;
      });

      it('should not send when id is "report"', () => {
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.notify_action('started', 'report', 'lock');

        expect(mockWs.send.called).to.be.false;
      });

      it('should not send when action is "triggers"', () => {
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.notify_action('started', '123', 'triggers');

        expect(mockWs.send.called).to.be.false;
      });

      it('should not send when action is factoryreset and status is stopped', () => {
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.notify_action('stopped', '123', 'factoryreset');

        expect(mockWs.send.called).to.be.false;
      });

      it('should remove from queue when retries exceed max', () => {
        websocketsRewired.__set__('ws', mockWs);
        websocketsRewired.responses_queue = [{ id: 'resp-1' }];

        websocketsRewired.notify_action('started', '123', 'lock', null, null, null, null, 'resp-1', 10);

        expect(websocketsRewired.responses_queue).to.have.length(0);
      });

      it('should send action when ws is ready and valid params', () => {
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.notify_action('started', '123', 'lock');

        expect(mockWs.send.calledOnce).to.be.true;
        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.reply_id).to.equal('123');
        expect(sentData.type).to.equal('response');
        expect(sentData.body.status).to.equal('started');
        expect(sentData.body.target).to.equal('lock');
      });

      it('should include error reason when error is provided', () => {
        websocketsRewired.__set__('ws', mockWs);
        const error = new Error('Test error');

        websocketsRewired.notify_action('stopped', '123', 'lock', null, error);

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.reason).to.equal('Test error');
      });

      it('should handle diskencryption action with out', () => {
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.notify_action('started', '123', 'diskencryption', null, null, 'encrypted');

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.reason.encryption).to.equal('encrypted');
      });

      it('should handle factoryreset action with out', () => {
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.notify_action('started', '123', 'factoryreset', null, null, { data: 0, message: 'success' });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.reason.status_code).to.equal(0);
        expect(sentData.body.reason.status_msg).to.equal('success');
      });
    });
  });

  // ==================== Utility Functions Tests ====================
  describe('Utility Functions', () => {
    describe('check_timestamp', () => {
      it('should return false when lastTime is null', () => {
        websocketsRewired.__set__('lastTime', null);

        expect(websocketsRewired.check_timestamp()).to.be.false;
      });

      it('should return false when lastTime is older than 5 minutes', () => {
        const oldTime = Date.now() - (6 * 60 * 1000);
        websocketsRewired.__set__('lastTime', oldTime);

        expect(websocketsRewired.check_timestamp()).to.be.false;
      });

      it('should return true when lastTime is recent', () => {
        websocketsRewired.__set__('lastTime', Date.now());

        expect(websocketsRewired.check_timestamp()).to.be.true;
      });
    });

    describe('lastConnection', () => {
      it('should return lastConnection value', () => {
        websocketsRewired.__set__('lastConnection', 1234567890);

        expect(websocketsRewired.lastConnection()).to.equal(1234567890);
      });

      it('should return undefined when not set', () => {
        websocketsRewired.__set__('lastConnection', undefined);

        expect(websocketsRewired.lastConnection()).to.be.undefined;
      });
    });

    describe('delay', () => {
      it('should return a timeout id', () => {
        const delay = websocketsRewired.__get__('delay');
        const callback = sinon.stub();

        const timeoutId = delay(1000, callback);

        expect(timeoutId).to.not.be.undefined;
        clearTimeout(timeoutId);
      });

      it('should be a function that takes ms and callback', () => {
        const delay = websocketsRewired.__get__('delay');

        expect(delay).to.be.a('function');
        expect(delay.length).to.equal(2);
      });
    });

    describe('propagateError', () => {
      it('should trigger error hook and log message', () => {
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('logger', mockLogger);

        const propagateError = websocketsRewired.__get__('propagateError');
        propagateError('Test error message');

        expect(mockHooks.trigger.calledWith('error')).to.be.true;
        expect(mockLogger.debug.calledWith('Test error message')).to.be.true;
      });
    });
  });

  // ==================== Message Handler Tests ====================
  describe('Message Handlers', () => {
    describe('groupByStructure (agruparPorEstructuraAnidada)', () => {
      it('should group objects by structure signature', () => {
        const groupByStructure = websocketsRewired.__get__('agruparPorEstructuraAnidada');

        const objects = [
          { action: 'lock', id: '1' },
          { action: 'alarm', id: '2' },
          { action: 'wipe', target: 'disk', id: '3' },
        ];

        const grouped = groupByStructure(objects);

        // First two have same structure (action, id)
        // Third has different structure (action, id, target)
        const keys = Object.keys(grouped);
        expect(keys).to.have.length(2);
      });

      it('should handle empty array', () => {
        const groupByStructure = websocketsRewired.__get__('agruparPorEstructuraAnidada');

        const grouped = groupByStructure([]);

        expect(grouped).to.deep.equal({});
      });

      it('should handle nested objects', () => {
        const groupByStructure = websocketsRewired.__get__('agruparPorEstructuraAnidada');

        const objects = [
          { action: 'lock', options: { force: true } },
          { action: 'alarm', options: { force: false } },
        ];

        const grouped = groupByStructure(objects);

        // Both have same structure
        const keys = Object.keys(grouped);
        expect(keys).to.have.length(1);
        expect(grouped[keys[0]]).to.have.length(2);
      });
    });

    describe('processAcks', () => {
      it('should process array of acks', () => {
        const processAcks = websocketsRewired.__get__('processAcks');

        const acks = [
          { ack_id: 'ack-1', id: 'cmd-1' },
          { ack_id: 'ack-2', id: 'cmd-2' },
        ];

        processAcks(acks);

        expect(websocketsRewired.responsesAck).to.have.length(2);
      });

      it('should not process items without ack_id', () => {
        const processAcks = websocketsRewired.__get__('processAcks');

        const items = [
          { id: 'cmd-1' }, // No ack_id
          { ack_id: 'ack-2', id: 'cmd-2' },
        ];

        processAcks(items);

        // Only one should be added (the one with ack_id)
        expect(websocketsRewired.responsesAck).to.have.length(1);
      });

      it('should only process if input has forEach method', () => {
        const processAcks = websocketsRewired.__get__('processAcks');

        // Objects without forEach are handled by the if check in processAcks
        // The function checks if arr.forEach exists before calling it
        processAcks([]);
        expect(websocketsRewired.responsesAck).to.have.length(0);
      });
    });

    describe('processCommands', () => {
      it('should emit commands via emitter', (done) => {
        const emitterMock = new EventEmitter();
        websocketsRewired.__set__('emitter', emitterMock);

        const processCommands = websocketsRewired.__get__('processCommands');

        emitterMock.on('command', (cmd) => {
          expect(cmd.action).to.equal('lock');
          done();
        });

        const commands = [{ action: 'lock', id: '1' }];

        processCommands(commands);
      });

      it('should handle empty array', () => {
        const emitterMock = new EventEmitter();
        websocketsRewired.__set__('emitter', emitterMock);

        const processCommands = websocketsRewired.__get__('processCommands');
        const commandSpy = sinon.spy();
        emitterMock.on('command', commandSpy);

        processCommands([]);

        expect(commandSpy.called).to.be.false;
      });
    });
  });

  // ==================== Interval Management Tests ====================
  describe('Interval Management', () => {
    describe('clearAndResetIntervals', () => {
      it('should clear all intervals and timeouts', () => {
        const clearAndResetIntervals = websocketsRewired.__get__('clearAndResetIntervals');

        // Set some intervals
        websocketsRewired.__set__('notifyActionInterval', setInterval(() => {}, 1000));
        websocketsRewired.__set__('notifyAckInterval', setInterval(() => {}, 1000));
        websocketsRewired.__set__('getStatusInterval', setInterval(() => {}, 1000));
        websocketsRewired.__set__('pingInterval', setInterval(() => {}, 1000));

        // Should not throw
        expect(() => clearAndResetIntervals()).to.not.throw();
      });

      it('should handle null intervals gracefully', () => {
        const clearAndResetIntervals = websocketsRewired.__get__('clearAndResetIntervals');

        websocketsRewired.__set__('notifyActionInterval', null);
        websocketsRewired.__set__('pingTimeout', null);

        expect(() => clearAndResetIntervals()).to.not.throw();
      });
    });
  });

  // ==================== Proxy Validation Tests ====================
  describe('Proxy Validation', () => {
    describe('validationConnectionsProxy', () => {
      it('should toggle workingWithProxy after max failures', () => {
        const configMock = {
          getData: sinon.stub().returns(true),
        };
        websocketsRewired.__set__('config', configMock);
        websocketsRewired.__set__('countNotConnectionProxy', 5);
        websocketsRewired.__set__('workingWithProxy', true);

        const validationConnectionsProxy = websocketsRewired.__get__('validationConnectionsProxy');
        validationConnectionsProxy();

        expect(websocketsRewired.__get__('workingWithProxy')).to.be.false;
        expect(websocketsRewired.__get__('countNotConnectionProxy')).to.equal(0);
      });

      it('should not toggle when proxy is not configured', () => {
        const configMock = {
          getData: sinon.stub().returns(false),
        };
        websocketsRewired.__set__('config', configMock);
        websocketsRewired.__set__('countNotConnectionProxy', 5);
        websocketsRewired.__set__('workingWithProxy', true);

        const validationConnectionsProxy = websocketsRewired.__get__('validationConnectionsProxy');
        validationConnectionsProxy();

        expect(websocketsRewired.__get__('workingWithProxy')).to.be.true;
      });
    });
  });

  // ==================== Lifecycle Tests ====================
  describe('Lifecycle Functions', () => {
    describe('unload', () => {
      it('should clear intervals and terminate ws', () => {
        websocketsRewired.__set__('ws', mockWs);
        websocketsRewired.__set__('hooks', mockHooks);
        const emitterMock = new EventEmitter();
        websocketsRewired.__set__('emitter', emitterMock);

        websocketsRewired.unload(() => {});

        expect(mockWs.terminate.calledOnce).to.be.true;
        expect(websocketsRewired.re_schedule).to.be.false;
      });

      it('should call callback', (done) => {
        websocketsRewired.__set__('ws', null);
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('emitter', null);

        websocketsRewired.unload(() => {
          done();
        });
      });

      it('should remove emitter listeners', () => {
        const emitterMock = new EventEmitter();
        emitterMock.on('test', () => {});
        websocketsRewired.__set__('emitter', emitterMock);
        websocketsRewired.__set__('ws', null);
        websocketsRewired.__set__('hooks', mockHooks);

        websocketsRewired.unload(() => {});

        expect(websocketsRewired.__get__('emitter')).to.be.null;
      });
    });
  });

  // ==================== Connection State Tests ====================
  describe('Connection State', () => {
    describe('websocketConnected flag', () => {
      it('should be false initially', () => {
        const websocketConnected = websocketsRewired.__get__('websocketConnected');
        expect(websocketConnected).to.be.false;
      });
    });

    describe('restartWebsocketCall', () => {
      it('should not restart if already reconnecting', () => {
        websocketsRewired.__set__('isReconnecting', true);
        websocketsRewired.__set__('ws', mockWs);

        const restartWebsocketCall = websocketsRewired.__get__('restartWebsocketCall');
        restartWebsocketCall();

        expect(mockWs.terminate.called).to.be.false;
      });

      it('should terminate ws when starting reconnection', () => {
        websocketsRewired.__set__('isReconnecting', false);
        websocketsRewired.__set__('ws', mockWs);
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.resetReconnectDelay();

        const restartWebsocketCall = websocketsRewired.__get__('restartWebsocketCall');
        restartWebsocketCall();

        expect(mockWs.terminate.calledOnce).to.be.true;
      });

      it('should set isReconnecting to true', () => {
        websocketsRewired.__set__('isReconnecting', false);
        websocketsRewired.__set__('ws', mockWs);
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.resetReconnectDelay();

        const restartWebsocketCall = websocketsRewired.__get__('restartWebsocketCall');
        restartWebsocketCall();

        expect(websocketsRewired.__get__('isReconnecting')).to.be.true;
      });
    });
  });
});
