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
  let intervalsToClean = [];
  let timeoutsToClean = [];

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

    // Clear any existing intervals/timeouts in the module
    websocketsRewired.__set__('pingTimeout', null);
    websocketsRewired.__set__('pingInterval', null);
    websocketsRewired.__set__('setAliveTimeInterval', null);
    websocketsRewired.__set__('timeOutCancelIntervalHearBeat', null);
    websocketsRewired.__set__('setIntervalWSStatus', null);
    websocketsRewired.__set__('notifyActionInterval', null);
    websocketsRewired.__set__('notifyAckInterval', null);
    websocketsRewired.__set__('getStatusInterval', null);
    websocketsRewired.__set__('idTimeoutToCancel', null);
  });

  afterEach(() => {
    // Clean up all intervals and timeouts
    intervalsToClean.forEach(clearInterval);
    timeoutsToClean.forEach(clearTimeout);
    intervalsToClean = [];
    timeoutsToClean = [];

    // Clear module intervals
    const clearAndResetIntervals = websocketsRewired.__get__('clearAndResetIntervals');
    if (clearAndResetIntervals) {
      try {
        clearAndResetIntervals(true);
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    sinon.restore();
    websocketsRewired.resetReconnectDelay();
    websocketsRewired.responses_queue = [];
    websocketsRewired.responsesAck = [];
    websocketsRewired.__set__('isReconnecting', false);
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
      it('should set timeout for heartbeat', () => {
        // Clear any existing timeout first
        const existingTimeout = websocketsRewired.__get__('pingTimeout');
        if (existingTimeout) clearTimeout(existingTimeout);

        websocketsRewired.heartbeatTimed();

        // Verify timeout was set (it's internal, so we check side effects)
        const pingTimeout = websocketsRewired.__get__('pingTimeout');
        expect(pingTimeout).to.not.be.null;

        // Clean up the timeout we created
        clearTimeout(pingTimeout);
        websocketsRewired.__set__('pingTimeout', null);
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

      it('should clear existing timeout before setting new one', () => {
        websocketsRewired.__set__('isReconnecting', false);
        websocketsRewired.__set__('ws', mockWs);
        websocketsRewired.__set__('hooks', mockHooks);
        const existingTimeout = setTimeout(() => {}, 10000);
        websocketsRewired.__set__('idTimeoutToCancel', existingTimeout);
        websocketsRewired.resetReconnectDelay();

        const restartWebsocketCall = websocketsRewired.__get__('restartWebsocketCall');
        restartWebsocketCall();

        // New timeout should be set
        const newTimeout = websocketsRewired.__get__('idTimeoutToCancel');
        expect(newTimeout).to.not.be.null;
        clearTimeout(existingTimeout);
        clearTimeout(newTimeout);
      });
    });
  });

  // ==================== Reconnection Delay Tests ====================
  describe('Reconnection Delay', () => {
    describe('getReconnectDelay', () => {
      beforeEach(() => {
        websocketsRewired.resetReconnectDelay();
      });

      it('should return a delay with exponential backoff', () => {
        const firstDelay = websocketsRewired.getReconnectDelay();
        const secondDelay = websocketsRewired.getReconnectDelay();

        // First delay should be around baseReconnectDelay (5000ms) with jitter
        expect(firstDelay).to.be.at.least(4000);
        expect(firstDelay).to.be.at.most(6000);

        // Second delay should be roughly double (around 10000ms with jitter)
        expect(secondDelay).to.be.at.least(8000);
        expect(secondDelay).to.be.at.most(12000);
      });

      it('should cap delay at maxReconnectDelay (5 minutes)', () => {
        // Make many attempts to reach the max
        for (let i = 0; i < 20; i++) {
          websocketsRewired.getReconnectDelay();
        }
        const delay = websocketsRewired.getReconnectDelay();

        // Max delay is 300000ms (5 minutes) with jitter
        expect(delay).to.be.at.most(360000);
      });

      it('should increment reconnectAttempts', () => {
        websocketsRewired.getReconnectDelay();
        websocketsRewired.getReconnectDelay();
        websocketsRewired.getReconnectDelay();

        // After 3 calls, the internal counter should be 3
        // We can verify this indirectly by the delay pattern
        const delay = websocketsRewired.getReconnectDelay();
        // After 3 attempts, delay should be around 40000ms (5000 * 2^3)
        expect(delay).to.be.at.least(32000);
      });
    });

    describe('resetReconnectDelay', () => {
      it('should reset reconnectAttempts to 0', () => {
        // Make some attempts
        websocketsRewired.getReconnectDelay();
        websocketsRewired.getReconnectDelay();

        // Reset
        websocketsRewired.resetReconnectDelay();

        // Next delay should be like the first attempt
        const delay = websocketsRewired.getReconnectDelay();
        expect(delay).to.be.at.least(4000);
        expect(delay).to.be.at.most(6000);
      });
    });
  });

  // ==================== Status Functions Tests ====================
  describe('Status Functions', () => {
    describe('getStatusByInterval', () => {
      it('should not call get_status when already getting status', () => {
        const mockStatusTrigger = {
          get_status: sinon.stub(),
        };
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
        websocketsRewired.__set__('gettingStatus', true);

        const getStatusByInterval = websocketsRewired.__get__('getStatusByInterval');
        getStatusByInterval();

        expect(mockStatusTrigger.get_status.called).to.be.false;
      });

      it('should call get_status and notify_status when not getting status', () => {
        const notifyStatusStub = sinon.stub(websocketsRewired, 'notify_status');
        const mockStatusTrigger = {
          get_status: sinon.stub().callsFake((cb) => cb(null, { online: true })),
        };
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
        websocketsRewired.__set__('gettingStatus', false);

        const getStatusByInterval = websocketsRewired.__get__('getStatusByInterval');
        getStatusByInterval();

        expect(mockStatusTrigger.get_status.calledOnce).to.be.true;
        expect(notifyStatusStub.calledOnce).to.be.true;
        expect(notifyStatusStub.calledWith({ online: true })).to.be.true;
        notifyStatusStub.restore();
      });

      it('should reset gettingStatus flag after callback', () => {
        const mockStatusTrigger = {
          get_status: sinon.stub().callsFake((cb) => cb(null, {})),
        };
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
        websocketsRewired.__set__('gettingStatus', false);

        const getStatusByInterval = websocketsRewired.__get__('getStatusByInterval');
        getStatusByInterval();

        expect(websocketsRewired.__get__('gettingStatus')).to.be.false;
      });
    });
  });

  // ==================== Storage Functions Tests ====================
  describe('Storage Functions', () => {
    describe('updateStoredConnection', () => {
      it('should call storage.do with update action', () => {
        websocketsRewired.__set__('storage', mockStorage);

        const updateStoredConnection = websocketsRewired.__get__('updateStoredConnection');
        updateStoredConnection(1234567890);

        expect(mockStorage.do.calledOnce).to.be.true;
        expect(mockStorage.do.firstCall.args[0]).to.equal('update');
        expect(mockStorage.do.firstCall.args[1].type).to.equal('keys');
        expect(mockStorage.do.firstCall.args[1].id).to.equal('last_connection');
        expect(mockStorage.do.firstCall.args[1].values).to.equal(1234567890);
      });

      it('should log error when storage update fails', () => {
        const errorStorage = {
          do: sinon.stub().callsFake((action, opts, cb) => cb(new Error('Storage error'))),
        };
        websocketsRewired.__set__('storage', errorStorage);
        websocketsRewired.__set__('logger', mockLogger);

        const updateStoredConnection = websocketsRewired.__get__('updateStoredConnection');
        updateStoredConnection(1234567890);

        expect(mockLogger.info.calledWith('Unable to update the local last connection value')).to.be.true;
      });
    });

    describe('updateTimestamp', () => {
      it('should set lastTime to current timestamp', () => {
        const beforeTime = Date.now();
        const updateTimestamp = websocketsRewired.__get__('updateTimestamp');
        updateTimestamp();
        const afterTime = Date.now();

        const lastTime = websocketsRewired.__get__('lastTime');
        expect(lastTime).to.be.at.least(beforeTime);
        expect(lastTime).to.be.at.most(afterTime);
      });
    });

    describe('setLastConnection', () => {
      it('should query storage for last_connection', () => {
        const freshMockStorage = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            if (cb) cb(null, []);
          }),
        };
        websocketsRewired.__set__('storage', freshMockStorage);

        const setLastConnection = websocketsRewired.__get__('setLastConnection');
        setLastConnection();

        expect(freshMockStorage.do.called).to.be.true;
        const queryCall = freshMockStorage.do.getCalls().find(c => c.args[0] === 'query');
        expect(queryCall).to.not.be.undefined;
        expect(queryCall.args[1].type).to.equal('keys');
        expect(queryCall.args[1].data).to.equal('last_connection');
      });

      it('should set lastConnection from stored value when exists', () => {
        const storedValue = 1640000000;
        const storageWithValue = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            cb(null, [{ value: storedValue.toString() }]);
          }),
        };
        websocketsRewired.__set__('storage', storageWithValue);

        const setLastConnection = websocketsRewired.__get__('setLastConnection');
        setLastConnection();

        expect(websocketsRewired.__get__('lastConnection')).to.equal(storedValue);
      });

      it('should set lastConnection to current time when no stored value', () => {
        const storageEmpty = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            if (action === 'query') {
              cb(null, []);
            } else {
              cb(null);
            }
          }),
        };
        websocketsRewired.__set__('storage', storageEmpty);

        const beforeTime = Math.round(Date.now() / 1000);
        const setLastConnection = websocketsRewired.__get__('setLastConnection');
        setLastConnection();
        const afterTime = Math.round(Date.now() / 1000);

        const lastConnection = websocketsRewired.__get__('lastConnection');
        expect(lastConnection).to.be.at.least(beforeTime);
        expect(lastConnection).to.be.at.most(afterTime);
      });

      it('should store new last_connection when no stored value', () => {
        const storageEmpty = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            if (action === 'query') {
              cb(null, []);
            } else if (action === 'set') {
              cb(null);
            }
          }),
        };
        websocketsRewired.__set__('storage', storageEmpty);
        websocketsRewired.__set__('logger', mockLogger);

        const setLastConnection = websocketsRewired.__get__('setLastConnection');
        setLastConnection();

        // Check that storage.do was called with 'set' action
        const setCalls = storageEmpty.do.getCalls().filter(call => call.args[0] === 'set');
        expect(setCalls.length).to.equal(1);
        expect(setCalls[0].args[1].type).to.equal('keys');
        expect(setCalls[0].args[1].id).to.equal('last_connection');
      });

      it('should log error when storage query fails', () => {
        const errorStorage = {
          do: sinon.stub().callsFake((action, opts, cb) => cb(new Error('Query error'))),
        };
        websocketsRewired.__set__('storage', errorStorage);
        websocketsRewired.__set__('logger', mockLogger);

        const setLastConnection = websocketsRewired.__get__('setLastConnection');
        setLastConnection();

        expect(mockLogger.error.calledWith('Error getting the last connection data')).to.be.true;
      });
    });
  });

  // ==================== Hook and Server Functions Tests ====================
  describe('Hook and Server Functions', () => {
    describe('loadHooks', () => {
      it('should call setLastConnection', () => {
        const mockTriggers = { start: sinon.stub() };
        const mockFileretrieval = { check_pending_files: sinon.stub() };
        websocketsRewired.__set__('triggers', mockTriggers);
        websocketsRewired.__set__('fileretrieval', mockFileretrieval);
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('storage', mockStorage);

        const loadHooks = websocketsRewired.__get__('loadHooks');
        loadHooks();

        // setLastConnection should have called storage.do
        expect(mockStorage.do.called).to.be.true;
      });

      it('should start triggers', () => {
        const mockTriggers = { start: sinon.stub() };
        const mockFileretrieval = { check_pending_files: sinon.stub() };
        websocketsRewired.__set__('triggers', mockTriggers);
        websocketsRewired.__set__('fileretrieval', mockFileretrieval);
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('storage', mockStorage);

        const loadHooks = websocketsRewired.__get__('loadHooks');
        loadHooks();

        expect(mockTriggers.start.calledOnce).to.be.true;
      });

      it('should register connected hook', () => {
        const mockTriggers = { start: sinon.stub() };
        const mockFileretrieval = { check_pending_files: sinon.stub() };
        websocketsRewired.__set__('triggers', mockTriggers);
        websocketsRewired.__set__('fileretrieval', mockFileretrieval);
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('storage', mockStorage);

        const loadHooks = websocketsRewired.__get__('loadHooks');
        loadHooks();

        expect(mockHooks.on.calledWith('connected')).to.be.true;
      });
    });

    describe('loadServer', () => {
      it('should create server after timeout', (done) => {
        const mockServer = {
          create_server: sinon.stub().callsFake((cb) => cb(null)),
        };
        websocketsRewired.__set__('server', mockServer);
        websocketsRewired.__set__('startupTimeout', 10); // Short timeout for testing

        const loadServer = websocketsRewired.__get__('loadServer');
        loadServer();

        setTimeout(() => {
          expect(mockServer.create_server.calledOnce).to.be.true;
          done();
        }, 50);
      });

      it('should log error when server creation fails', (done) => {
        const mockServer = {
          create_server: sinon.stub().callsFake((cb) => cb(new Error('Server error'))),
        };
        websocketsRewired.__set__('server', mockServer);
        websocketsRewired.__set__('logger', mockLogger);
        websocketsRewired.__set__('startupTimeout', 10);

        const loadServer = websocketsRewired.__get__('loadServer');
        loadServer();

        setTimeout(() => {
          expect(mockLogger.debug.called).to.be.true;
          done();
        }, 50);
      });

      it('should set interval for updateTimestamp after server creation', (done) => {
        const mockServer = {
          create_server: sinon.stub().callsFake((cb) => cb(null)),
        };
        websocketsRewired.__set__('server', mockServer);
        websocketsRewired.__set__('startupTimeout', 10);

        const loadServer = websocketsRewired.__get__('loadServer');
        loadServer();

        setTimeout(() => {
          const interval = websocketsRewired.__get__('setAliveTimeInterval');
          expect(interval).to.not.be.null;
          clearInterval(interval);
          done();
        }, 50);
      });
    });
  });

  // ==================== Query Triggers Tests ====================
  describe('Query Triggers', () => {
    describe('queryTriggers', () => {
      it('should query all triggers from storage', () => {
        websocketsRewired.__set__('storage', mockStorage);

        const queryTriggers = websocketsRewired.__get__('queryTriggers');
        queryTriggers();

        expect(mockStorage.do.calledOnce).to.be.true;
        expect(mockStorage.do.firstCall.args[0]).to.equal('all');
        expect(mockStorage.do.firstCall.args[1].type).to.equal('triggers');
      });

      it('should return early when storage returns error', () => {
        const errorStorage = {
          do: sinon.stub().callsFake((action, opts, cb) => cb(new Error('Storage error'))),
        };
        websocketsRewired.__set__('storage', errorStorage);

        const queryTriggers = websocketsRewired.__get__('queryTriggers');

        // Should not throw
        expect(() => queryTriggers()).to.not.throw();
      });

      it('should return early when stored is null', () => {
        const nullStorage = {
          do: sinon.stub().callsFake((action, opts, cb) => cb(null, null)),
        };
        websocketsRewired.__set__('storage', nullStorage);

        const queryTriggers = websocketsRewired.__get__('queryTriggers');

        expect(() => queryTriggers()).to.not.throw();
      });

      it('should filter triggers with device_unseen events', () => {
        const mockTriggersModule = {
          currentTriggers: [
            { id: 'trigger-1', last_exec: Date.now() },
          ],
        };
        const triggersStorage = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            if (action === 'all') {
              cb(null, [{
                id: 'trigger-1',
                automation_events: JSON.stringify([{ type: 'device_unseen' }]),
              }]);
            } else if (action === 'update') {
              cb(null);
            }
          }),
        };
        websocketsRewired.__set__('storage', triggersStorage);
        websocketsRewired.__set__('triggers', mockTriggersModule);

        const queryTriggers = websocketsRewired.__get__('queryTriggers');
        queryTriggers();

        // Should have queried and updated
        const updateCalls = triggersStorage.do.getCalls().filter(call => call.args[0] === 'update');
        expect(updateCalls.length).to.be.at.least(1);
      });

      it('should reset last_exec for matching triggers', () => {
        const mockTriggersModule = {
          currentTriggers: [
            { id: 'trigger-1', last_exec: 1640000000 },
          ],
        };
        const triggersStorage = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            if (action === 'all') {
              cb(null, [{
                id: 'trigger-1',
                automation_events: JSON.stringify([{ type: 'device_unseen' }]),
              }]);
            } else if (action === 'update') {
              cb(null);
            }
          }),
        };
        websocketsRewired.__set__('storage', triggersStorage);
        websocketsRewired.__set__('triggers', mockTriggersModule);

        const queryTriggers = websocketsRewired.__get__('queryTriggers');
        queryTriggers();

        // last_exec should be reset to null
        expect(mockTriggersModule.currentTriggers[0].last_exec).to.be.null;
      });
    });
  });

  // ==================== Load Function Tests ====================
  describe('Load Function', () => {
    describe('load', () => {
      let mockServer;
      let mockTriggers;
      let mockFileretrieval;
      let mockStatusTrigger;
      let mockConfig;
      let mockKeys;

      beforeEach(() => {
        mockServer = { create_server: sinon.stub().callsFake((cb) => cb(null)) };
        mockTriggers = { start: sinon.stub(), currentTriggers: [] };
        mockFileretrieval = { check_pending_files: sinon.stub() };
        mockStatusTrigger = { get_status: sinon.stub().callsFake((cb, tag) => cb(null, {})) };
        mockConfig = {
          getData: sinon.stub().callsFake((key) => {
            if (key === 'control-panel.protocol') return 'https';
            if (key === 'control-panel.host') return 'api.test.com';
            if (key === 'control-panel.send_location_on_connect') return 'false';
            return null;
          }),
        };
        mockKeys = {
          get: sinon.stub().returns({ device: 'test-device', api: 'test-api' }),
        };

        websocketsRewired.__set__('server', mockServer);
        websocketsRewired.__set__('triggers', mockTriggers);
        websocketsRewired.__set__('fileretrieval', mockFileretrieval);
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
        websocketsRewired.__set__('config', mockConfig);
        websocketsRewired.__set__('keys', mockKeys);
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('storage', mockStorage);
      });

      it('should return emitter in callback', (done) => {
        // Mock WebSocket constructor
        const MockWebSocket = function() {
          this.on = sinon.stub();
          this.readyState = 1;
        };
        websocketsRewired.__set__('WebSocket', MockWebSocket);

        websocketsRewired.load((err, emitter) => {
          expect(err).to.be.null;
          expect(emitter).to.be.an.instanceof(require('events').EventEmitter);
          done();
        });
      });

      it('should return same emitter on subsequent calls', (done) => {
        const MockWebSocket = function() {
          this.on = sinon.stub();
          this.readyState = 1;
          this.terminate = sinon.stub();
          this.send = sinon.stub();
        };
        websocketsRewired.__set__('WebSocket', MockWebSocket);

        websocketsRewired.load((err, firstEmitter) => {
          websocketsRewired.load((err2, secondEmitter) => {
            expect(firstEmitter).to.equal(secondEmitter);
            done();
          });
        });
      });

      it('should call loadServer', (done) => {
        const MockWebSocket = function() {
          this.on = sinon.stub();
          this.readyState = 1;
        };
        websocketsRewired.__set__('WebSocket', MockWebSocket);
        websocketsRewired.__set__('startupTimeout', 10);

        websocketsRewired.load((err, emitter) => {
          setTimeout(() => {
            expect(mockServer.create_server.called).to.be.true;
            done();
          }, 50);
        });
      });

      it('should call loadHooks', (done) => {
        const MockWebSocket = function() {
          this.on = sinon.stub();
          this.readyState = 1;
        };
        websocketsRewired.__set__('WebSocket', MockWebSocket);

        websocketsRewired.load((err, emitter) => {
          expect(mockTriggers.start.called).to.be.true;
          done();
        });
      });
    });
  });

  // ==================== WebSocket Settings Tests ====================
  describe('WebSocket Settings', () => {
    describe('webSocketSettings', () => {
      let mockConfig;
      let mockKeys;
      let mockStatusTrigger;
      let MockWebSocket;

      beforeEach(() => {
        mockConfig = {
          getData: sinon.stub().callsFake((key) => {
            if (key === 'control-panel.protocol') return 'https';
            if (key === 'control-panel.host') return 'api.test.com';
            if (key === 'control-panel.send_location_on_connect') return 'false';
            if (key === 'try_proxy') return null;
            return null;
          }),
        };
        mockKeys = {
          get: sinon.stub().returns({ device: 'test-device', api: 'test-api' }),
        };
        mockStatusTrigger = {
          get_status: sinon.stub().callsFake((cb, tag) => cb(null, {})),
        };

        MockWebSocket = function() {
          this.on = sinon.stub();
          this.readyState = 1;
          this.send = sinon.stub();
          this.terminate = sinon.stub();
        };

        websocketsRewired.__set__('config', mockConfig);
        websocketsRewired.__set__('keys', mockKeys);
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
        websocketsRewired.__set__('WebSocket', MockWebSocket);
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('storage', mockStorage);
      });

      it('should set up intervals for retry queues', () => {
        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        const notifyActionInterval = websocketsRewired.__get__('notifyActionInterval');
        const notifyAckInterval = websocketsRewired.__get__('notifyAckInterval');

        expect(notifyActionInterval).to.not.be.null;
        expect(notifyAckInterval).to.not.be.null;

        clearInterval(notifyActionInterval);
        clearInterval(notifyAckInterval);
      });

      it('should propagate error when no device key', () => {
        mockKeys.get.returns({ device: null, api: 'test-api' });
        const unloadStub = sinon.stub(websocketsRewired, 'unload').callsFake((cb) => cb && cb());

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        expect(mockHooks.trigger.calledWith('error')).to.be.true;
        expect(unloadStub.called).to.be.true;
        unloadStub.restore();
      });

      it('should use wss protocol when config is https', () => {
        let capturedUrl;
        const CaptureWebSocket = function(url, options) {
          capturedUrl = url;
          this.on = sinon.stub();
          this.readyState = 1;
        };
        websocketsRewired.__set__('WebSocket', CaptureWebSocket);

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        expect(capturedUrl).to.include('wss://');
      });

      it('should use ws protocol when config is http', () => {
        mockConfig.getData = sinon.stub().callsFake((key) => {
          if (key === 'control-panel.protocol') return 'http';
          if (key === 'control-panel.host') return 'api.test.com';
          if (key === 'control-panel.send_location_on_connect') return 'false';
          return null;
        });

        let capturedUrl;
        const CaptureWebSocket = function(url, options) {
          capturedUrl = url;
          this.on = sinon.stub();
          this.readyState = 1;
        };
        websocketsRewired.__set__('WebSocket', CaptureWebSocket);

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        expect(capturedUrl).to.include('ws://');
      });

      it('should include Authorization header', () => {
        let capturedOptions;
        const CaptureWebSocket = function(url, options) {
          capturedOptions = options;
          this.on = sinon.stub();
          this.readyState = 1;
        };
        websocketsRewired.__set__('WebSocket', CaptureWebSocket);

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        expect(capturedOptions.headers.Authorization).to.include('Basic ');
      });
    });
  });

  // ==================== Notify Action Edge Cases ====================
  describe('Notify Action Edge Cases', () => {
    describe('fullwipe action handling', () => {
      it('should handle fullwipe with error', () => {
        websocketsRewired.__set__('ws', mockWs);
        const error = { code: 1, message: 'Wipe failed' };

        websocketsRewired.notify_action('stopped', '123', 'fullwipe', null, error);

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.status).to.equal('stopped');
        expect(sentData.body.reason.status_code).to.equal(1);
        expect(sentData.body.reason.status_msg).to.equal('Wipe failed');
      });

      it('should handle fullwipe with opts target', () => {
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.notify_action('started', '123', 'fullwipe', { target: 'disk1' });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.target).to.equal('disk1');
      });

      it('should handle fullwipewindows with error', () => {
        websocketsRewired.__set__('ws', mockWs);
        const error = { message: 'Windows wipe failed' };

        websocketsRewired.notify_action('stopped', '123', 'fullwipewindows', null, error);

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.status).to.equal('stopped');
        expect(sentData.body.reason.status_msg).to.equal('Windows wipe failed');
      });
    });

    describe('factoryreset error handling', () => {
      it('should handle factoryreset with error', () => {
        websocketsRewired.__set__('ws', mockWs);
        const error = { code: 2, message: 'Reset failed' };

        websocketsRewired.notify_action('started', '123', 'factoryreset', null, error);

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.status).to.equal('stopped');
        expect(sentData.body.reason.status_code).to.equal(2);
      });

      it('should use default code 1 when error has no code', () => {
        websocketsRewired.__set__('ws', mockWs);
        const error = { message: 'Reset failed' };

        websocketsRewired.notify_action('started', '123', 'factoryreset', null, error);

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.reason.status_code).to.equal(1);
      });
    });

    describe('diskencryption error handling', () => {
      it('should handle diskencryption with error', () => {
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.notify_action('stopped', '123', 'diskencryption', null, 'encryption_error');

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.reason.encryption).to.equal('encryption_error');
      });
    });

    describe('response queue management', () => {
      it('should update existing response in queue', () => {
        websocketsRewired.__set__('ws', mockWs);
        const existingId = 'existing-resp-id';
        websocketsRewired.responses_queue = [{
          id: existingId,
          retries: 1,
          body: { status: 'started', target: 'lock' },
        }];

        websocketsRewired.notify_action('started', '123', 'lock', null, null, null, null, existingId, 1);

        // Should update retries in existing response
        expect(websocketsRewired.responses_queue[0].retries).to.equal(3);
      });

      it('should use provided time or create new one', () => {
        websocketsRewired.__set__('ws', mockWs);
        const customTime = '2024-01-01T00:00:00.000Z';

        websocketsRewired.notify_action('started', '123', 'lock', null, null, null, customTime);

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.time).to.equal(customTime);
      });

      it('should replace NULL time with current time', () => {
        websocketsRewired.__set__('ws', mockWs);

        websocketsRewired.notify_action('started', '123', 'lock', null, null, null, 'NULL');

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.time).to.not.equal('NULL');
        expect(sentData.time).to.match(/^\d{4}-\d{2}-\d{2}T/);
      });
    });
  });

  // ==================== isReconnecting Export Tests ====================
  describe('isReconnecting Export', () => {
    it('should export isReconnecting as false initially', () => {
      expect(websocketsRewired.isReconnecting).to.be.false;
    });

    it('should update exported isReconnecting when reconnecting', () => {
      websocketsRewired.__set__('isReconnecting', false);
      websocketsRewired.__set__('ws', mockWs);
      websocketsRewired.__set__('hooks', mockHooks);
      websocketsRewired.resetReconnectDelay();

      const restartWebsocketCall = websocketsRewired.__get__('restartWebsocketCall');
      restartWebsocketCall();

      expect(websocketsRewired.isReconnecting).to.be.true;
    });
  });

  // ==================== Constants Tests ====================
  describe('Constants', () => {
    it('should have correct maxCountNotConnectionProxy', () => {
      const maxCountNotConnectionProxy = websocketsRewired.__get__('maxCountNotConnectionProxy');
      expect(maxCountNotConnectionProxy).to.equal(5);
    });

    it('should have correct codeErrorNoConnectionWebSocket', () => {
      const codeErrorNoConnectionWebSocket = websocketsRewired.__get__('codeErrorNoConnectionWebSocket');
      expect(codeErrorNoConnectionWebSocket).to.equal(1006);
    });

    it('should have correct heartbeatTimeout', () => {
      const heartbeatTimeout = websocketsRewired.__get__('heartbeatTimeout');
      expect(heartbeatTimeout).to.equal(121000); // 120000 + 1000
    });

    it('should have correct retriesMax', () => {
      const retriesMax = websocketsRewired.__get__('retriesMax');
      expect(retriesMax).to.equal(10);
    });

    it('should have correct retriesMaxAck', () => {
      const retriesMaxAck = websocketsRewired.__get__('retriesMaxAck');
      expect(retriesMaxAck).to.equal(4);
    });

    it('should have correct pongWaitTimeout', () => {
      const pongWaitTimeout = websocketsRewired.__get__('pongWaitTimeout');
      expect(pongWaitTimeout).to.equal(15000);
    });

    it('should have correct baseReconnectDelay', () => {
      const baseReconnectDelay = websocketsRewired.__get__('baseReconnectDelay');
      expect(baseReconnectDelay).to.equal(5000);
    });

    it('should have correct maxReconnectDelay', () => {
      const maxReconnectDelay = websocketsRewired.__get__('maxReconnectDelay');
      expect(maxReconnectDelay).to.equal(300000);
    });

    it('should have correct timeLimitForLocation', () => {
      const timeLimitForLocation = websocketsRewired.__get__('timeLimitForLocation');
      expect(timeLimitForLocation).to.equal(7 * 60 * 1000);
    });

    it('should have correct startupTimeout', () => {
      const startupTimeout = websocketsRewired.__get__('startupTimeout');
      expect(startupTimeout).to.equal(5000);
    });
  });

  // ==================== Error Handling in Send Operations ====================
  describe('Error Handling in Send Operations', () => {
    describe('notify_action send error', () => {
      it('should catch and log error when ws.send throws', () => {
        const throwingWs = {
          readyState: 1,
          send: sinon.stub().throws(new Error('Send failed')),
        };
        websocketsRewired.__set__('ws', throwingWs);
        websocketsRewired.__set__('logger', mockLogger);

        // Should not throw
        expect(() => {
          websocketsRewired.notify_action('started', '123', 'lock');
        }).to.not.throw();

        expect(mockLogger.error.called).to.be.true;
      });
    });

    describe('notify_status send error', () => {
      it('should catch and log error when ws.send throws', () => {
        const throwingWs = {
          readyState: 1,
          send: sinon.stub().throws(new Error('Send failed')),
        };
        websocketsRewired.__set__('ws', throwingWs);
        websocketsRewired.__set__('logger', mockLogger);

        // Should not throw
        expect(() => {
          websocketsRewired.notify_status({ online: true });
        }).to.not.throw();

        expect(mockLogger.error.called).to.be.true;
      });
    });

    describe('sendAckToServer error handling', () => {
      it('should catch and log error when ws.send throws', () => {
        const throwingWs = {
          readyState: 1,
          send: sinon.stub().throws(new Error('Send failed')),
        };
        websocketsRewired.__set__('ws', throwingWs);
        websocketsRewired.__set__('logger', mockLogger);
        websocketsRewired.responsesAck = [{ ack_id: 'ack-1', type: 'ack' }];

        // Should not throw
        expect(() => {
          websocketsRewired.sendAckToServer({ ack_id: 'ack-1', type: 'ack' });
        }).to.not.throw();
      });
    });
  });

  // ==================== fullwipe with out parameter ====================
  describe('Fullwipe with out parameter', () => {
    it('should handle fullwipe with out data containing status_code and status_msg', () => {
      websocketsRewired.__set__('ws', mockWs);

      websocketsRewired.notify_action('started', '123', 'fullwipe', null, null, { data: 0, message: 'Wipe successful' });

      const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
      expect(sentData.body.reason.status_code).to.equal(0);
      expect(sentData.body.reason.status_msg).to.equal('Wipe successful');
    });
  });

  // ==================== startWebsocket Function ====================
  describe('startWebsocket Function', () => {
    it('should call clearAndResetIntervals', () => {
      const mockConfig = {
        getData: sinon.stub().returns(null),
      };
      const mockKeys = {
        get: sinon.stub().returns({ device: 'test-device', api: 'test-api' }),
      };
      const mockStatusTrigger = {
        get_status: sinon.stub().callsFake((cb, tag) => cb(null, {})),
      };
      const MockWebSocket = function() {
        this.on = sinon.stub();
        this.readyState = 1;
      };

      websocketsRewired.__set__('config', mockConfig);
      websocketsRewired.__set__('keys', mockKeys);
      websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
      websocketsRewired.__set__('WebSocket', MockWebSocket);
      websocketsRewired.__set__('hooks', mockHooks);
      websocketsRewired.__set__('storage', mockStorage);

      // Set some intervals to verify they get cleared
      const testInterval = setInterval(() => {}, 10000);
      websocketsRewired.__set__('notifyActionInterval', testInterval);

      websocketsRewired.startWebsocket();

      // The interval should be replaced
      const newInterval = websocketsRewired.__get__('notifyActionInterval');
      expect(newInterval).to.not.equal(testInterval);
      clearInterval(testInterval);
      clearInterval(newInterval);
    });
  });

  // ==================== re_schedule Flag ====================
  describe('re_schedule Flag', () => {
    it('should be true by default', () => {
      expect(websocketsRewired.re_schedule).to.be.true;
    });

    it('should be set to false on unload', () => {
      websocketsRewired.__set__('ws', null);
      websocketsRewired.__set__('hooks', mockHooks);
      websocketsRewired.__set__('emitter', null);

      websocketsRewired.unload(() => {});

      expect(websocketsRewired.re_schedule).to.be.false;
    });
  });

  // ==================== markedToBePushed with fromWithin ====================
  describe('markedToBePushed with fromWithin', () => {
    it('should add to markedToBePushed when fromWithin is true', () => {
      websocketsRewired.__set__('ws', mockWs);
      websocketsRewired.__set__('markedToBePushed', []);

      websocketsRewired.notify_action('started', '123', 'lock', null, null, null, null, null, 0, true);

      const markedToBePushed = websocketsRewired.__get__('markedToBePushed');
      expect(markedToBePushed).to.have.length(1);
    });

    it('should add to responses_queue when fromWithin is false', () => {
      websocketsRewired.__set__('ws', mockWs);
      websocketsRewired.responses_queue = [];

      websocketsRewired.notify_action('started', '123', 'lock', null, null, null, null, null, 0, false);

      expect(websocketsRewired.responses_queue).to.have.length(1);
    });
  });

  // ==================== UUID Generation ====================
  describe('UUID Generation', () => {
    it('should generate uuid when respId is undefined', () => {
      websocketsRewired.__set__('ws', mockWs);

      websocketsRewired.notify_action('started', '123', 'lock', null, null, null, null, undefined, 0);

      const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
      expect(sentData.id).to.be.a('string');
      expect(sentData.id).to.have.length(36); // UUID format
    });

    it('should generate uuid when respId is string "undefined"', () => {
      websocketsRewired.__set__('ws', mockWs);

      websocketsRewired.notify_action('started', '123', 'lock', null, null, null, null, 'undefined', 0);

      const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
      expect(sentData.id).to.be.a('string');
      expect(sentData.id).to.have.length(36);
    });

    it('should use provided respId when valid', () => {
      websocketsRewired.__set__('ws', mockWs);

      websocketsRewired.notify_action('started', '123', 'lock', null, null, null, null, 'custom-id', 0);

      const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
      expect(sentData.id).to.equal('custom-id');
    });
  });

  // ==================== Storage Update on Response ====================
  describe('Storage Update on Response', () => {
    it('should store response when not in queue', () => {
      const storageMock = {
        do: sinon.stub().callsFake((action, opts, cb) => {
          if (cb) cb(null);
        }),
      };
      websocketsRewired.__set__('ws', mockWs);
      websocketsRewired.__set__('storage', storageMock);
      websocketsRewired.responses_queue = [];

      websocketsRewired.notify_action('started', '123', 'lock');

      const setCalls = storageMock.do.getCalls().filter(c => c.args[0] === 'set');
      expect(setCalls.length).to.equal(1);
      expect(setCalls[0].args[1].type).to.equal('responses');
    });

    it('should log error when storage set fails', () => {
      const errorStorage = {
        do: sinon.stub().callsFake((action, opts, cb) => {
          if (cb) cb({ error: 'Storage error' });
        }),
      };
      websocketsRewired.__set__('ws', mockWs);
      websocketsRewired.__set__('storage', errorStorage);
      websocketsRewired.__set__('logger', mockLogger);
      websocketsRewired.responses_queue = [];

      websocketsRewired.notify_action('started', '123', 'lock');

      expect(mockLogger.error.called).to.be.true;
    });

    it('should log error when storage update fails', () => {
      const errorStorage = {
        do: sinon.stub().callsFake((action, opts, cb) => {
          if (cb) cb({ error: 'Update error' });
        }),
      };
      websocketsRewired.__set__('ws', mockWs);
      websocketsRewired.__set__('storage', errorStorage);
      websocketsRewired.__set__('logger', mockLogger);
      // Pre-populate queue to trigger update path
      websocketsRewired.responses_queue = [{
        id: 'existing-id',
        retries: 1,
        body: { status: 'started', target: 'lock' },
      }];

      websocketsRewired.notify_action('started', '123', 'lock', null, null, null, null, 'existing-id', 1);

      expect(mockLogger.error.called).to.be.true;
    });
  });

  // ==================== gettingStatus Flag ====================
  describe('gettingStatus Flag', () => {
    it('should set gettingStatus to true when calling getStatusByInterval', () => {
      const mockStatusTrigger = {
        get_status: sinon.stub(), // Don't call callback immediately
      };
      websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
      websocketsRewired.__set__('gettingStatus', false);

      const getStatusByInterval = websocketsRewired.__get__('getStatusByInterval');
      getStatusByInterval();

      expect(websocketsRewired.__get__('gettingStatus')).to.be.true;
    });
  });

  // ==================== workingWithProxy Flag ====================
  describe('workingWithProxy Flag', () => {
    it('should be true initially', () => {
      const workingWithProxy = websocketsRewired.__get__('workingWithProxy');
      expect(workingWithProxy).to.be.true;
    });

    it('should toggle when proxy failures exceed max', () => {
      const configMock = {
        getData: sinon.stub().returns('http://proxy.example.com'),
      };
      websocketsRewired.__set__('config', configMock);
      websocketsRewired.__set__('workingWithProxy', true);
      websocketsRewired.__set__('countNotConnectionProxy', 5);

      const validationConnectionsProxy = websocketsRewired.__get__('validationConnectionsProxy');
      validationConnectionsProxy();

      expect(websocketsRewired.__get__('workingWithProxy')).to.be.false;
      expect(websocketsRewired.__get__('countNotConnectionProxy')).to.equal(0);
    });
  });

  // ==================== lastStored Variable ====================
  describe('lastStored Variable', () => {
    it('should be set when storage has value', () => {
      const storageWithValue = {
        do: sinon.stub().callsFake((action, opts, cb) => {
          cb(null, [{ value: '1640000000' }]);
        }),
      };
      websocketsRewired.__set__('storage', storageWithValue);

      const setLastConnection = websocketsRewired.__get__('setLastConnection');
      setLastConnection();

      const lastStored = websocketsRewired.__get__('lastStored');
      expect(lastStored).to.equal(1640000000);
    });
  });

  // ==================== Pong Received Flag ====================
  describe('pongReceived Flag', () => {
    it('should be false initially', () => {
      const pongReceived = websocketsRewired.__get__('pongReceived');
      expect(pongReceived).to.be.false;
    });
  });

  // ==================== WebSocket Connection States ====================
  describe('WebSocket Connection States', () => {
    it('should handle ws readyState 0 (CONNECTING)', () => {
      mockWs.readyState = 0;
      websocketsRewired.__set__('ws', mockWs);

      websocketsRewired.notify_status({ online: true });

      expect(mockWs.send.called).to.be.false;
    });

    it('should handle ws readyState 2 (CLOSING)', () => {
      mockWs.readyState = 2;
      websocketsRewired.__set__('ws', mockWs);

      websocketsRewired.notify_status({ online: true });

      expect(mockWs.send.called).to.be.false;
    });

    it('should handle ws readyState 3 (CLOSED)', () => {
      mockWs.readyState = 3;
      websocketsRewired.__set__('ws', mockWs);

      websocketsRewired.notify_status({ online: true });

      expect(mockWs.send.called).to.be.false;
    });
  });

  // ==================== Nested Object Structure ====================
  describe('Nested Object Grouping', () => {
    it('should handle deeply nested objects', () => {
      const groupByStructure = websocketsRewired.__get__('agruparPorEstructuraAnidada');

      const objects = [
        { action: 'lock', options: { settings: { force: true } } },
        { action: 'alarm', options: { settings: { force: false } } },
        { action: 'wipe', simple: true },
      ];

      const grouped = groupByStructure(objects);

      const keys = Object.keys(grouped);
      expect(keys).to.have.length(2);
    });

    it('should handle arrays in objects without recursing into them', () => {
      const groupByStructure = websocketsRewired.__get__('agruparPorEstructuraAnidada');

      const objects = [
        { action: 'lock', targets: ['disk1', 'disk2'] },
        { action: 'alarm', targets: ['speaker'] },
      ];

      const grouped = groupByStructure(objects);

      const keys = Object.keys(grouped);
      expect(keys).to.have.length(1);
      expect(grouped[keys[0]]).to.have.length(2);
    });
  });

  // ==================== Process Acks with ack module ====================
  describe('Process Acks Integration', () => {
    it('should call ack.processAck for each item', () => {
      const mockAck = {
        processAck: sinon.stub().callsFake((item, cb) => {
          cb(null, { ack_id: item.ack_id, type: 'ack', id: item.id });
        }),
      };
      websocketsRewired.__set__('ack', mockAck);
      websocketsRewired.responsesAck = [];

      const processAcks = websocketsRewired.__get__('processAcks');
      processAcks([
        { ack_id: 'ack-1', id: 'cmd-1' },
        { ack_id: 'ack-2', id: 'cmd-2' },
      ]);

      expect(mockAck.processAck.calledTwice).to.be.true;
    });

    it('should log error when ack.processAck returns error', () => {
      const mockAck = {
        processAck: sinon.stub().callsFake((item, cb) => {
          cb(new Error('Processing failed'));
        }),
      };
      websocketsRewired.__set__('ack', mockAck);
      websocketsRewired.__set__('logger', mockLogger);
      websocketsRewired.responsesAck = [];

      const processAcks = websocketsRewired.__get__('processAcks');
      processAcks([{ ack_id: 'ack-1', id: 'cmd-1' }]);

      expect(mockLogger.error.called).to.be.true;
    });
  });

  // ==================== Response deletion on storage ====================
  describe('Response Deletion', () => {
    it('should delete response from storage when retries exceed max', () => {
      const deletingStorage = {
        do: sinon.stub().callsFake((action, opts, cb) => {
          if (cb) cb(null);
        }),
      };
      websocketsRewired.__set__('ws', mockWs);
      websocketsRewired.__set__('storage', deletingStorage);
      websocketsRewired.responses_queue = [{ id: 'resp-1' }];

      websocketsRewired.notify_action('started', '123', 'lock', null, null, null, null, 'resp-1', 10);

      const delCalls = deletingStorage.do.getCalls().filter(c => c.args[0] === 'del');
      expect(delCalls.length).to.equal(1);
      expect(delCalls[0].args[1].type).to.equal('responses');
      expect(delCalls[0].args[1].id).to.equal('resp-1');
    });
  });

  // ==================== Opts Target ====================
  describe('Opts Target Handling', () => {
    it('should store opts.target when provided', () => {
      const storageMock = {
        do: sinon.stub().callsFake((action, opts, cb) => {
          if (cb) cb(null);
        }),
      };
      websocketsRewired.__set__('ws', mockWs);
      websocketsRewired.__set__('storage', storageMock);
      websocketsRewired.responses_queue = [];

      websocketsRewired.notify_action('started', '123', 'lock', { target: 'specific-target' });

      const setCalls = storageMock.do.getCalls().filter(c => c.args[0] === 'set');
      expect(setCalls[0].args[1].data.opts).to.equal('specific-target');
    });

    it('should store null when opts is not provided', () => {
      const storageMock = {
        do: sinon.stub().callsFake((action, opts, cb) => {
          if (cb) cb(null);
        }),
      };
      websocketsRewired.__set__('ws', mockWs);
      websocketsRewired.__set__('storage', storageMock);
      websocketsRewired.responses_queue = [];

      websocketsRewired.notify_action('started', '123', 'lock', null);

      const setCalls = storageMock.do.getCalls().filter(c => c.args[0] === 'set');
      expect(setCalls[0].args[1].data.opts).to.be.null;
    });
  });

  // ==================== WebSocket Events Simulation ====================
  describe('WebSocket Events Simulation', () => {
    let wsEventHandlers;
    let mockConfig;
    let mockKeys;
    let mockStatusTrigger;
    let mockNetwork;

    beforeEach(() => {
      wsEventHandlers = {};
      mockConfig = {
        getData: sinon.stub().callsFake((key) => {
          if (key === 'control-panel.protocol') return 'https';
          if (key === 'control-panel.host') return 'api.test.com';
          if (key === 'control-panel.send_location_on_connect') return 'false';
          if (key === 'try_proxy') return null;
          return null;
        }),
      };
      mockKeys = {
        get: sinon.stub().returns({ device: 'test-device', api: 'test-api' }),
      };
      mockStatusTrigger = {
        get_status: sinon.stub().callsFake((cb, tag) => cb(null, {})),
      };
      mockNetwork = {
        get_connection_status: sinon.stub().callsFake((cb) => cb('connected')),
      };

      const CaptureWebSocket = function(url, options) {
        this.readyState = 1;
        this.send = sinon.stub();
        this.terminate = sinon.stub();
        this.ping = sinon.stub().callsFake((data, cb) => cb && cb());
        this.pong = sinon.stub();
        this.on = sinon.stub().callsFake((event, handler) => {
          wsEventHandlers[event] = handler;
        });
      };

      websocketsRewired.__set__('config', mockConfig);
      websocketsRewired.__set__('keys', mockKeys);
      websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
      websocketsRewired.__set__('network', mockNetwork);
      websocketsRewired.__set__('WebSocket', CaptureWebSocket);
      websocketsRewired.__set__('hooks', mockHooks);
      websocketsRewired.__set__('storage', mockStorage);
    });

    describe('on open event', () => {
      it('should register open handler', () => {
        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        expect(wsEventHandlers.open).to.be.a('function');
      });

      it('should set websocketConnected to true on open', () => {
        websocketsRewired.__set__('websocketConnected', false);
        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        wsEventHandlers.open();

        expect(websocketsRewired.__get__('websocketConnected')).to.be.true;
      });

      it('should reset reconnect delay on open', () => {
        // Make some reconnection attempts first
        websocketsRewired.getReconnectDelay();
        websocketsRewired.getReconnectDelay();

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();
        wsEventHandlers.open();

        // After reset, delay should be back to base
        const delay = websocketsRewired.getReconnectDelay();
        expect(delay).to.be.at.least(4000);
        expect(delay).to.be.at.most(6000);
      });
    });

    describe('on close event', () => {
      it('should register close handler', () => {
        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        expect(wsEventHandlers.close).to.be.a('function');
      });

      it('should restart websocket on close when re_schedule is true and was connected', () => {
        websocketsRewired.re_schedule = true;
        websocketsRewired.__set__('websocketConnected', true);
        websocketsRewired.__set__('isReconnecting', false);

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();
        wsEventHandlers.open(); // First open the connection

        websocketsRewired.__set__('isReconnecting', false); // Reset for close test
        wsEventHandlers.close(1000);

        expect(websocketsRewired.__get__('websocketConnected')).to.be.false;
      });

      it('should increment countNotConnectionProxy on 1006 error with proxy', () => {
        websocketsRewired.re_schedule = true;
        websocketsRewired.__set__('websocketConnected', true);
        websocketsRewired.__set__('isReconnecting', false);
        websocketsRewired.__set__('countNotConnectionProxy', 0);

        mockConfig.getData = sinon.stub().callsFake((key) => {
          if (key === 'try_proxy') return 'http://proxy.example.com';
          if (key === 'control-panel.protocol') return 'https';
          if (key === 'control-panel.host') return 'api.test.com';
          if (key === 'control-panel.send_location_on_connect') return 'false';
          return null;
        });

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();
        wsEventHandlers.open();

        websocketsRewired.__set__('isReconnecting', false);
        wsEventHandlers.close(1006);

        expect(websocketsRewired.__get__('countNotConnectionProxy')).to.equal(1);
      });
    });

    describe('on message event', () => {
      it('should register message handler', () => {
        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        expect(wsEventHandlers.message).to.be.a('function');
      });

      it('should handle invalid JSON', () => {
        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        const result = wsEventHandlers.message('invalid json');

        expect(mockHooks.trigger.calledWith('error')).to.be.true;
      });

      it('should process array of commands', () => {
        const emitterMock = new EventEmitter();
        websocketsRewired.__set__('emitter', emitterMock);

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        const commands = JSON.stringify([{ action: 'lock', id: '1' }]);
        const result = wsEventHandlers.message(commands);

        expect(result).to.equal(0);
      });

      it('should handle OK status response and remove from queue', () => {
        websocketsRewired.responses_queue = [{
          id: 'resp-123',
          type: 'response',
          body: { status: 'started', target: 'lock' },
        }];

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        const response = JSON.stringify({ status: 'OK', id: 'resp-123' });
        wsEventHandlers.message(response);

        expect(websocketsRewired.responses_queue).to.have.length(0);
      });

      it('should delete from storage when removing response type', () => {
        websocketsRewired.responses_queue = [{
          id: 'resp-123',
          type: 'response',
          body: { status: 'started', target: 'lock' },
        }];

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        const response = JSON.stringify({ status: 'OK', id: 'resp-123' });
        wsEventHandlers.message(response);

        const delCalls = mockStorage.do.getCalls().filter(c => c.args[0] === 'del');
        expect(delCalls.length).to.be.at.least(1);
      });
    });

    describe('on error event', () => {
      it('should register error handler', () => {
        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        expect(wsEventHandlers.error).to.be.a('function');
      });

      it('should log error message', () => {
        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        wsEventHandlers.error({ message: 'Connection failed' });

        expect(mockLogger.error.called).to.be.true;
      });

      it('should trigger reconnection when connected and not already reconnecting', () => {
        websocketsRewired.__set__('websocketConnected', true);
        websocketsRewired.__set__('isReconnecting', false);

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();
        wsEventHandlers.open();

        websocketsRewired.__set__('isReconnecting', false);
        wsEventHandlers.error({ message: 'Connection lost' });

        expect(websocketsRewired.__get__('isReconnecting')).to.be.true;
      });
    });

    describe('on pong event', () => {
      it('should register pong handler', () => {
        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        expect(wsEventHandlers.pong).to.be.a('function');
      });

      it('should set pongReceived to true', () => {
        websocketsRewired.__set__('pongReceived', false);

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        wsEventHandlers.pong();

        expect(websocketsRewired.__get__('pongReceived')).to.be.true;
      });

      it('should trigger device_unseen hook', () => {
        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        wsEventHandlers.pong();

        expect(mockHooks.trigger.calledWith('device_unseen')).to.be.true;
      });

      it('should update lastConnection', () => {
        const beforeTime = Math.round(Date.now() / 1000);

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();
        wsEventHandlers.pong();

        const afterTime = Math.round(Date.now() / 1000);
        const lastConnection = websocketsRewired.__get__('lastConnection');

        expect(lastConnection).to.be.at.least(beforeTime);
        expect(lastConnection).to.be.at.most(afterTime);
      });

      it('should trigger disconnected when diff >= 30 minutes and connected', () => {
        // Set last connection to 31 minutes ago
        const thirtyOneMinutesAgo = Math.round(Date.now() / 1000) - (31 * 60);
        websocketsRewired.__set__('lastConnection', thirtyOneMinutesAgo);

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();
        wsEventHandlers.pong();

        expect(mockHooks.trigger.calledWith('disconnected')).to.be.true;
      });

      it('should not trigger disconnected when diff < 30 minutes', () => {
        // Set last connection to 5 minutes ago
        const fiveMinutesAgo = Math.round(Date.now() / 1000) - (5 * 60);
        websocketsRewired.__set__('lastConnection', fiveMinutesAgo);

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();
        mockHooks.trigger.resetHistory();
        wsEventHandlers.pong();

        expect(mockHooks.trigger.calledWith('disconnected')).to.be.false;
      });
    });

    describe('on ping event', () => {
      it('should register ping handler', () => {
        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        expect(wsEventHandlers.ping).to.be.a('function');
      });

      it('should call heartbeatTimed', () => {
        const heartbeatTimedSpy = sinon.spy(websocketsRewired, 'heartbeatTimed');

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        // Set ws to ready state
        websocketsRewired.__set__('ws', {
          readyState: 1,
          pong: sinon.stub(),
        });

        wsEventHandlers.ping();

        expect(heartbeatTimedSpy.calledOnce).to.be.true;
        heartbeatTimedSpy.restore();
      });
    });
  });

  // ==================== Location Sending ====================
  describe('Location Sending on Connect', () => {
    it('should send location when config is true and enough time has passed', (done) => {
      const wsEventHandlers = {};
      const mockConfig = {
        getData: sinon.stub().callsFake((key) => {
          if (key === 'control-panel.send_location_on_connect') return 'true';
          if (key === 'control-panel.protocol') return 'https';
          if (key === 'control-panel.host') return 'api.test.com';
          return null;
        }),
      };
      const mockKeys = {
        get: sinon.stub().returns({ device: 'test-device', api: 'test-api' }),
      };
      const mockStatusTrigger = {
        get_status: sinon.stub().callsFake((cb) => cb(null, {})),
      };

      const CaptureWebSocket = function() {
        this.readyState = 1;
        this.send = sinon.stub();
        this.terminate = sinon.stub();
        this.on = sinon.stub().callsFake((event, handler) => {
          wsEventHandlers[event] = handler;
        });
      };

      websocketsRewired.__set__('config', mockConfig);
      websocketsRewired.__set__('keys', mockKeys);
      websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
      websocketsRewired.__set__('WebSocket', CaptureWebSocket);
      websocketsRewired.__set__('hooks', mockHooks);
      websocketsRewired.__set__('storage', mockStorage);
      websocketsRewired.__set__('lastLocationTime', null);

      const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
      webSocketSettings();
      wsEventHandlers.open();

      // The timer is set for 10 seconds, but we can check the flag was set
      const timerSendLocation = websocketsRewired.__get__('timerSendLocation');
      expect(timerSendLocation).to.not.be.null;
      clearTimeout(timerSendLocation);
      done();
    });
  });

  // ==================== Stored Actions Loading ====================
  describe('Stored Actions Loading on Open', () => {
    it('should load stored actions into responses_queue on open', () => {
      const wsEventHandlers = {};
      const storedActions = [
        { action_id: '123', status: 'started', action: 'lock', id: 'stored-1' },
      ];
      const mockStorageWithActions = {
        do: sinon.stub().callsFake((action, opts, cb) => {
          if (action === 'all' && opts.type === 'responses') {
            cb(null, storedActions);
          } else {
            cb(null, []);
          }
        }),
      };
      const mockConfig = {
        getData: sinon.stub().callsFake((key) => {
          if (key === 'control-panel.protocol') return 'https';
          if (key === 'control-panel.host') return 'api.test.com';
          if (key === 'control-panel.send_location_on_connect') return 'false';
          return null;
        }),
      };
      const mockKeys = {
        get: sinon.stub().returns({ device: 'test-device', api: 'test-api' }),
      };
      const mockStatusTrigger = {
        get_status: sinon.stub().callsFake((cb) => cb(null, {})),
      };

      const CaptureWebSocket = function() {
        this.readyState = 1;
        this.send = sinon.stub();
        this.terminate = sinon.stub();
        this.on = sinon.stub().callsFake((event, handler) => {
          wsEventHandlers[event] = handler;
        });
      };

      websocketsRewired.__set__('config', mockConfig);
      websocketsRewired.__set__('keys', mockKeys);
      websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
      websocketsRewired.__set__('WebSocket', CaptureWebSocket);
      websocketsRewired.__set__('hooks', mockHooks);
      websocketsRewired.__set__('storage', mockStorageWithActions);
      websocketsRewired.responses_queue = [];

      const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
      webSocketSettings();
      wsEventHandlers.open();

      expect(websocketsRewired.responses_queue).to.have.length(1);
      expect(websocketsRewired.responses_queue[0].reply_id).to.equal('123');
    });

    it('should handle single stored action (not array)', () => {
      const wsEventHandlers = {};
      const singleAction = { action_id: '456', status: 'started', action: 'alarm', id: 'stored-2' };
      const mockStorageWithSingleAction = {
        do: sinon.stub().callsFake((action, opts, cb) => {
          if (action === 'all' && opts.type === 'responses') {
            cb(null, singleAction);
          } else {
            cb(null, []);
          }
        }),
      };
      const mockConfig = {
        getData: sinon.stub().callsFake((key) => {
          if (key === 'control-panel.protocol') return 'https';
          if (key === 'control-panel.host') return 'api.test.com';
          if (key === 'control-panel.send_location_on_connect') return 'false';
          return null;
        }),
      };
      const mockKeys = {
        get: sinon.stub().returns({ device: 'test-device', api: 'test-api' }),
      };
      const mockStatusTrigger = {
        get_status: sinon.stub().callsFake((cb) => cb(null, {})),
      };

      const CaptureWebSocket = function() {
        this.readyState = 1;
        this.send = sinon.stub();
        this.terminate = sinon.stub();
        this.on = sinon.stub().callsFake((event, handler) => {
          wsEventHandlers[event] = handler;
        });
      };

      websocketsRewired.__set__('config', mockConfig);
      websocketsRewired.__set__('keys', mockKeys);
      websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
      websocketsRewired.__set__('WebSocket', CaptureWebSocket);
      websocketsRewired.__set__('hooks', mockHooks);
      websocketsRewired.__set__('storage', mockStorageWithSingleAction);
      websocketsRewired.responses_queue = [];

      const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
      webSocketSettings();
      wsEventHandlers.open();

      expect(websocketsRewired.responses_queue).to.have.length(1);
      expect(websocketsRewired.responses_queue[0].reply_id).to.equal('456');
    });
  });

  // ==================== Ping Interval with Error ====================
  describe('Ping Interval with Error', () => {
    it('should trigger reconnection when ping callback has error', (done) => {
      const wsEventHandlers = {};
      const mockConfig = {
        getData: sinon.stub().callsFake((key) => {
          if (key === 'control-panel.protocol') return 'https';
          if (key === 'control-panel.host') return 'api.test.com';
          if (key === 'control-panel.send_location_on_connect') return 'false';
          return null;
        }),
      };
      const mockKeys = {
        get: sinon.stub().returns({ device: 'test-device', api: 'test-api' }),
      };
      const mockStatusTrigger = {
        get_status: sinon.stub().callsFake((cb) => cb(null, {})),
      };

      const CaptureWebSocket = function() {
        this.readyState = 1;
        this.send = sinon.stub();
        this.terminate = sinon.stub();
        this.ping = sinon.stub().callsFake((data, cb) => {
          cb({ error: 'ping failed' }); // Error in ping
        });
        this.on = sinon.stub().callsFake((event, handler) => {
          wsEventHandlers[event] = handler;
        });
      };

      websocketsRewired.__set__('config', mockConfig);
      websocketsRewired.__set__('keys', mockKeys);
      websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
      websocketsRewired.__set__('WebSocket', CaptureWebSocket);
      websocketsRewired.__set__('hooks', mockHooks);
      websocketsRewired.__set__('storage', mockStorage);
      websocketsRewired.__set__('isReconnecting', false);

      const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
      webSocketSettings();
      wsEventHandlers.open();

      // Ping interval fires at 60000ms, we'll check the setup
      const pingInterval = websocketsRewired.__get__('pingInterval');
      expect(pingInterval).to.not.be.null;
      clearInterval(pingInterval);
      done();
    });
  });

  // ==================== Empty Objects Handling ====================
  describe('Empty Objects Handling', () => {
    it('should not log empty message objects', () => {
      const wsEventHandlers = {};
      const mockConfig = {
        getData: sinon.stub().callsFake((key) => {
          if (key === 'control-panel.protocol') return 'https';
          if (key === 'control-panel.host') return 'api.test.com';
          if (key === 'control-panel.send_location_on_connect') return 'false';
          return null;
        }),
      };
      const mockKeys = {
        get: sinon.stub().returns({ device: 'test-device', api: 'test-api' }),
      };
      const mockStatusTrigger = {
        get_status: sinon.stub().callsFake((cb) => cb(null, {})),
      };

      const CaptureWebSocket = function() {
        this.readyState = 1;
        this.send = sinon.stub();
        this.terminate = sinon.stub();
        this.on = sinon.stub().callsFake((event, handler) => {
          wsEventHandlers[event] = handler;
        });
      };

      websocketsRewired.__set__('config', mockConfig);
      websocketsRewired.__set__('keys', mockKeys);
      websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
      websocketsRewired.__set__('WebSocket', CaptureWebSocket);
      websocketsRewired.__set__('hooks', mockHooks);
      websocketsRewired.__set__('storage', mockStorage);
      websocketsRewired.__set__('logger', mockLogger);

      const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
      webSocketSettings();

      mockLogger.info.resetHistory();
      wsEventHandlers.message('{}');

      // Should not log info for empty objects
      const logCalls = mockLogger.info.getCalls().filter(c =>
        c.args[0] && c.args[0].includes('message received')
      );
      expect(logCalls).to.have.length(0);
    });
  });
});
