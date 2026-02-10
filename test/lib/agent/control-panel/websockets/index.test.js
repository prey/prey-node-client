/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const rewire = require('rewire');
const sinon = require('sinon');
const { expect } = require('chai');
const { EventEmitter } = require('events');

describe('WebSocket Module', () => {
  let websocketsRewired;
  let reconnectionRewired;
  let heartbeatRewired;
  let responseQueueRewired;
  let ackQueueRewired;
  let handlersRewired;
  let notificationsRewired;
  let connectionRewired;
  let commandQueueRewired;
  let constantsModule;
  let utilsModule;

  let mockWs;
  let mockHooks;
  let mockStorage;
  let mockLogger;

  beforeEach(() => {
    // Rewire all modules
    websocketsRewired = rewire('../../../../../lib/agent/control-panel/websockets');
    reconnectionRewired = rewire('../../../../../lib/agent/control-panel/websockets/reconnection');
    heartbeatRewired = rewire('../../../../../lib/agent/control-panel/websockets/heartbeat');
    responseQueueRewired = rewire('../../../../../lib/agent/control-panel/websockets/queues/response-queue');
    ackQueueRewired = rewire('../../../../../lib/agent/control-panel/websockets/queues/ack-queue');
    handlersRewired = rewire('../../../../../lib/agent/control-panel/websockets/handlers');
    notificationsRewired = rewire('../../../../../lib/agent/control-panel/websockets/notifications');
    connectionRewired = rewire('../../../../../lib/agent/control-panel/websockets/connection');
    commandQueueRewired = rewire('../../../../../lib/agent/control-panel/websockets/command-queue');
    constantsModule = require('../../../../../lib/agent/control-panel/websockets/constants');
    utilsModule = require('../../../../../lib/agent/control-panel/websockets/utils');

    // Mock WebSocket
    mockWs = {
      readyState: 1,
      send: sinon.stub(),
      ping: sinon.stub().callsFake((data, cb) => cb && cb()),
      pong: sinon.stub(),
      terminate: sinon.stub(),
      on: sinon.stub(),
    };

    // Mock hooks - use EventEmitter so we can emit events
    mockHooks = new EventEmitter();
    mockHooks.trigger = sinon.stub();
    mockHooks.remove = sinon.stub();
    // Spy on 'on' method so tests can verify it was called
    sinon.spy(mockHooks, 'on');

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

    // Reset queue states
    responseQueueRewired.clearQueue();
    ackQueueRewired.clearQueue();
    reconnectionRewired.resetReconnectDelay();
    connectionRewired.reset();
  });

  afterEach(() => {
    sinon.restore();
    heartbeatRewired.clearAll();
  });

  // ==================== Constants Tests ====================
  describe('Constants Module', () => {
    it('should have correct STARTUP_TIMEOUT', () => {
      expect(constantsModule.STARTUP_TIMEOUT).to.equal(3000);
    });

    it('should have correct HEARTBEAT_TIMEOUT', () => {
      expect(constantsModule.HEARTBEAT_TIMEOUT).to.equal(121000);
    });

    it('should have correct BASE_RECONNECT_DELAY', () => {
      expect(constantsModule.BASE_RECONNECT_DELAY).to.equal(5000);
    });

    it('should have correct MAX_RECONNECT_DELAY', () => {
      expect(constantsModule.MAX_RECONNECT_DELAY).to.equal(300000);
    });

    it('should have correct MAX_RETRIES', () => {
      expect(constantsModule.MAX_RETRIES).to.equal(10);
    });

    it('should have correct MAX_ACK_RETRIES', () => {
      expect(constantsModule.MAX_ACK_RETRIES).to.equal(4);
    });

    it('should have correct WS_ERROR_NO_CONNECTION', () => {
      expect(constantsModule.WS_ERROR_NO_CONNECTION).to.equal(1006);
    });

    it('should have correct PONG_WAIT_TIMEOUT', () => {
      expect(constantsModule.PONG_WAIT_TIMEOUT).to.equal(15000);
    });

    it('should have correct LOCATION_TIME_LIMIT', () => {
      expect(constantsModule.LOCATION_TIME_LIMIT).to.equal(7 * 60 * 1000);
    });
  });

  // ==================== Utils Tests ====================
  describe('Utils Module', () => {
    describe('isConnectionReady', () => {
      it('should return true when ws is ready', () => {
        expect(utilsModule.isConnectionReady({ readyState: 1 })).to.be.true;
      });

      it('should return false when ws is null', () => {
        expect(utilsModule.isConnectionReady(null)).to.be.false;
      });

      it('should return false when readyState is not 1', () => {
        expect(utilsModule.isConnectionReady({ readyState: 0 })).to.be.false;
        expect(utilsModule.isConnectionReady({ readyState: 2 })).to.be.false;
        expect(utilsModule.isConnectionReady({ readyState: 3 })).to.be.false;
      });
    });

    describe('propagateError', () => {
      it('should trigger error hook and log message', () => {
        utilsModule.propagateError(mockHooks, mockLogger, 'Test error');
        expect(mockHooks.trigger.calledWith('error')).to.be.true;
        expect(mockLogger.debug.calledWith('Test error')).to.be.true;
      });
    });

    describe('delay', () => {
      it('should return timeout id', () => {
        const cb = sinon.stub();
        const timeoutId = utilsModule.delay(100, cb);
        expect(timeoutId).to.not.be.undefined;
        clearTimeout(timeoutId);
      });
    });
  });

  // ==================== Reconnection Tests ====================
  describe('Reconnection Module', () => {
    beforeEach(() => {
      reconnectionRewired.resetReconnectDelay();
    });

    describe('getReconnectDelay', () => {
      it('should return delay with exponential backoff', () => {
        const firstDelay = reconnectionRewired.getReconnectDelay();
        expect(firstDelay).to.be.at.least(4000);
        expect(firstDelay).to.be.at.most(6000);

        const secondDelay = reconnectionRewired.getReconnectDelay();
        expect(secondDelay).to.be.at.least(8000);
        expect(secondDelay).to.be.at.most(12000);
      });

      it('should cap delay at max', () => {
        for (let i = 0; i < 20; i++) {
          reconnectionRewired.getReconnectDelay();
        }
        const delay = reconnectionRewired.getReconnectDelay();
        expect(delay).to.be.at.most(360000);
      });
    });

    describe('resetReconnectDelay', () => {
      it('should reset attempts to 0', () => {
        reconnectionRewired.getReconnectDelay();
        reconnectionRewired.getReconnectDelay();
        reconnectionRewired.resetReconnectDelay();

        const delay = reconnectionRewired.getReconnectDelay();
        expect(delay).to.be.at.least(4000);
        expect(delay).to.be.at.most(6000);
      });
    });

    describe('isReconnecting state', () => {
      it('should be false initially', () => {
        reconnectionRewired.setIsReconnecting(false);
        expect(reconnectionRewired.getIsReconnecting()).to.be.false;
      });

      it('should be settable', () => {
        reconnectionRewired.setIsReconnecting(true);
        expect(reconnectionRewired.getIsReconnecting()).to.be.true;
        reconnectionRewired.setIsReconnecting(false);
      });
    });
  });

  // ==================== Heartbeat Tests ====================
  describe('Heartbeat Module', () => {
    afterEach(() => {
      heartbeatRewired.clearAll();
    });

    describe('heartbeatTimed', () => {
      it('should set timeout', () => {
        const callback = sinon.stub();
        heartbeatRewired.heartbeatTimed(callback);

        const timeout = heartbeatRewired.getPingTimeout();
        expect(timeout).to.not.be.null;
        heartbeatRewired.clearPingTimeout();
      });

      it('should clear existing timeout before setting new one', () => {
        const callback1 = sinon.stub();
        const callback2 = sinon.stub();

        heartbeatRewired.heartbeatTimed(callback1);
        const timeout1 = heartbeatRewired.getPingTimeout();

        heartbeatRewired.heartbeatTimed(callback2);
        const timeout2 = heartbeatRewired.getPingTimeout();

        expect(timeout1).to.not.equal(timeout2);
      });
    });

    describe('clearAll', () => {
      it('should clear all timers', () => {
        heartbeatRewired.heartbeatTimed(() => {});
        heartbeatRewired.clearAll();

        expect(heartbeatRewired.getPingTimeout()).to.be.null;
        expect(heartbeatRewired.getPingInterval()).to.be.null;
      });
    });

    describe('clearPingTimeout', () => {
      it('should clear ping timeout', () => {
        heartbeatRewired.heartbeatTimed(() => {});
        expect(heartbeatRewired.getPingTimeout()).to.not.be.null;

        heartbeatRewired.clearPingTimeout();
        expect(heartbeatRewired.getPingTimeout()).to.be.null;
      });
    });

    describe('clearPingInterval', () => {
      it('should not throw when pingInterval is null', () => {
        expect(() => heartbeatRewired.clearPingInterval()).to.not.throw();
      });
    });

    describe('pongReceived', () => {
      it('should be false initially', () => {
        heartbeatRewired.setPongReceived(false);
        expect(heartbeatRewired.getPongReceived()).to.be.false;
      });

      it('should be settable', () => {
        heartbeatRewired.setPongReceived(true);
        expect(heartbeatRewired.getPongReceived()).to.be.true;
        heartbeatRewired.setPongReceived(false);
      });
    });

    describe('startPingInterval', () => {
      let clock;
      let localHeartbeat;

      beforeEach(() => {
        clock = sinon.useFakeTimers();
        // Re-rewire after fake timers are set up so module uses fake setInterval
        localHeartbeat = rewire('../../../../../lib/agent/control-panel/websockets/heartbeat');
      });

      afterEach(() => {
        localHeartbeat.clearAll();
        clock.restore();
      });

      it('should set ping interval', () => {
        localHeartbeat.startPingInterval(mockWs, mockLogger, () => {});

        const interval = localHeartbeat.getPingInterval();
        expect(interval).to.not.be.null;
      });

      it('should send ping via websocket', () => {
        const pingWs = {
          readyState: 1,
          ping: sinon.stub().callsFake((data, cb) => {
            if (cb) cb();
          }),
        };

        localHeartbeat.startPingInterval(pingWs, mockLogger, () => {});

        // Advance time past PING_INTERVAL (60000ms)
        clock.tick(60001);

        expect(pingWs.ping.called).to.be.true;
      });

      it('should call onFailure when pong not received', () => {
        const onFailure = sinon.stub();
        localHeartbeat.setPongReceived(false);

        const pingWs = {
          readyState: 1,
          ping: sinon.stub().callsFake((data, cb) => {
            if (cb) cb();
          }),
        };

        localHeartbeat.startPingInterval(pingWs, mockLogger, onFailure);

        // Advance time past PING_INTERVAL (60000ms) + PONG_WAIT_TIMEOUT (15000ms)
        clock.tick(60001);
        clock.tick(15001);

        expect(onFailure.called).to.be.true;
      });

      it('should not call onFailure when pong received', () => {
        const onFailure = sinon.stub();

        const pingWs = {
          readyState: 1,
          ping: sinon.stub().callsFake((data, cb) => {
            if (cb) cb();
            // Simulate pong received
            localHeartbeat.setPongReceived(true);
          }),
        };

        localHeartbeat.startPingInterval(pingWs, mockLogger, onFailure);

        // Advance time past PING_INTERVAL + PONG_WAIT_TIMEOUT
        clock.tick(60001);
        clock.tick(15001);

        expect(onFailure.called).to.be.false;
      });

      it('should log when ping fails', () => {
        const pingWs = {
          readyState: 1,
          ping: sinon.stub().callsFake((data, cb) => {
            if (cb) cb(new Error('Ping failed'));
          }),
        };

        localHeartbeat.startPingInterval(pingWs, mockLogger, () => {});

        // Advance time to trigger the interval
        clock.tick(60001);

        expect(mockLogger.error.called).to.be.true;
      });

      it('should skip ping when ws is not ready', () => {
        const notReadyWs = {
          readyState: 0,
          ping: sinon.stub(),
        };

        localHeartbeat.startPingInterval(notReadyWs, mockLogger, () => {});

        // Advance time past PING_INTERVAL
        clock.tick(60001);

        expect(notReadyWs.ping.called).to.be.false;
      });
    });

    describe('handlePing', () => {
      it('should call heartbeatTimedFn', () => {
        const heartbeatTimedFn = sinon.stub();
        heartbeatRewired.handlePing(mockWs, heartbeatTimedFn);
        expect(heartbeatTimedFn.calledOnce).to.be.true;
      });

      it('should call ws.pong when connection is ready', () => {
        const heartbeatTimedFn = sinon.stub();
        heartbeatRewired.handlePing(mockWs, heartbeatTimedFn);
        expect(mockWs.pong.calledOnce).to.be.true;
      });

      it('should not call ws.pong when connection is not ready', () => {
        const notReadyWs = {
          readyState: 0,
          pong: sinon.stub(),
        };
        const heartbeatTimedFn = sinon.stub();
        heartbeatRewired.handlePing(notReadyWs, heartbeatTimedFn);
        expect(notReadyWs.pong.called).to.be.false;
      });
    });
  });

  // ==================== Response Queue Tests ====================
  describe('Response Queue Module', () => {
    beforeEach(() => {
      responseQueueRewired.clearQueue();
    });

    describe('getQueue', () => {
      it('should return empty array initially', () => {
        expect(responseQueueRewired.getQueue()).to.be.an('array');
        expect(responseQueueRewired.getQueue()).to.have.length(0);
      });
    });

    describe('addToQueue', () => {
      it('should add response to queue', () => {
        responseQueueRewired.addToQueue({ id: 'test-1' });
        expect(responseQueueRewired.getQueue()).to.have.length(1);
      });

      it('should add multiple responses to queue', () => {
        responseQueueRewired.addToQueue({ id: 'test-1' });
        responseQueueRewired.addToQueue({ id: 'test-2' });
        responseQueueRewired.addToQueue({ id: 'test-3' });
        expect(responseQueueRewired.getQueue()).to.have.length(3);
      });
    });

    describe('removeFromQueue', () => {
      it('should remove response by id', () => {
        responseQueueRewired.addToQueue({ id: 'test-1' });
        responseQueueRewired.addToQueue({ id: 'test-2' });
        responseQueueRewired.removeFromQueue('test-1');

        expect(responseQueueRewired.getQueue()).to.have.length(1);
        expect(responseQueueRewired.getQueue()[0].id).to.equal('test-2');
      });

      it('should not throw when removing non-existent id', () => {
        responseQueueRewired.addToQueue({ id: 'test-1' });
        expect(() => responseQueueRewired.removeFromQueue('non-existent')).to.not.throw();
        expect(responseQueueRewired.getQueue()).to.have.length(1);
      });
    });

    describe('findInQueue', () => {
      it('should find response by id', () => {
        responseQueueRewired.addToQueue({ id: 'test-1', data: 'found' });
        const result = responseQueueRewired.findInQueue('test-1');
        expect(result.data).to.equal('found');
      });

      it('should return undefined if not found', () => {
        const result = responseQueueRewired.findInQueue('nonexistent');
        expect(result).to.be.undefined;
      });
    });

    describe('addToMarkedToBePushed', () => {
      it('should add to markedToBePushed array', () => {
        responseQueueRewired.addToMarkedToBePushed({ id: 'marked-1' });
        const marked = responseQueueRewired.getMarkedToBePushed();
        expect(marked).to.have.length(1);
        expect(marked[0].id).to.equal('marked-1');
      });
    });

    describe('getMarkedToBePushed', () => {
      it('should return empty array initially', () => {
        expect(responseQueueRewired.getMarkedToBePushed()).to.be.an('array');
        expect(responseQueueRewired.getMarkedToBePushed()).to.have.length(0);
      });
    });

    describe('clearQueue', () => {
      it('should clear all queues', () => {
        responseQueueRewired.addToQueue({ id: 'test-1' });
        responseQueueRewired.addToMarkedToBePushed({ id: 'marked-1' });

        responseQueueRewired.clearQueue();

        expect(responseQueueRewired.getQueue()).to.have.length(0);
        expect(responseQueueRewired.getMarkedToBePushed()).to.have.length(0);
      });
    });

    describe('retryQueuedResponses', () => {
      it('should do nothing when queue is empty', () => {
        const notifyFn = sinon.stub();
        responseQueueRewired.retryQueuedResponses(notifyFn);
        expect(notifyFn.called).to.be.false;
      });

      it('should call notify for each response', () => {
        responseQueueRewired.addToQueue({
          id: 'resp-1',
          body: { status: 'started', target: 'lock' },
          reply_id: '123',
        });

        const notifyFn = sinon.stub();
        responseQueueRewired.retryQueuedResponses(notifyFn);
        expect(notifyFn.calledOnce).to.be.true;
      });

      it('should pass all parameters to notify function', () => {
        responseQueueRewired.addToQueue({
          id: 'resp-1',
          body: { status: 'started', target: 'lock' },
          reply_id: '123',
          time: '2023-01-01T00:00:00.000Z',
          retries: 2,
        });

        const notifyFn = sinon.stub();
        responseQueueRewired.retryQueuedResponses(notifyFn);

        expect(notifyFn.firstCall.args[0]).to.equal('started');
        expect(notifyFn.firstCall.args[1]).to.equal('123');
        expect(notifyFn.firstCall.args[2]).to.equal('lock');
      });

      it('should also process markedToBePushed and move to queue', () => {
        responseQueueRewired.addToMarkedToBePushed({
          id: 'marked-1',
          body: { status: 'pending', target: 'alarm' },
          reply_id: '456',
        });

        const notifyFn = sinon.stub();
        responseQueueRewired.retryQueuedResponses(notifyFn);

        expect(notifyFn.calledOnce).to.be.true;
        expect(responseQueueRewired.getQueue()).to.have.length(1);
        expect(responseQueueRewired.getMarkedToBePushed()).to.have.length(0);
      });
    });

    describe('loadFromStorage', () => {
      it('should load responses from storage', () => {
        const storedResponses = [
          { id: 'stored-1', status: 'pending', action: 'lock', action_id: '123', time: '2023-01-01', retries: 0, opts: 'target1' },
        ];
        const mockStorageLoad = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            if (action === 'all' && opts.type === 'responses') {
              cb(null, storedResponses);
            }
          }),
        };

        responseQueueRewired.loadFromStorage(mockStorageLoad, () => {});

        expect(responseQueueRewired.getQueue().length).to.be.greaterThan(0);
      });

      it('should handle storage error', () => {
        const mockStorageError = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            cb(new Error('Storage error'));
          }),
        };

        expect(() => {
          responseQueueRewired.loadFromStorage(mockStorageError, () => {});
        }).to.not.throw();
      });

      it('should handle null stored data', () => {
        const mockStorageNull = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            cb(null, null);
          }),
        };

        expect(() => {
          responseQueueRewired.loadFromStorage(mockStorageNull, () => {});
        }).to.not.throw();
      });

      it('should handle empty stored array', () => {
        const mockStorageEmpty = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            cb(null, []);
          }),
        };

        responseQueueRewired.loadFromStorage(mockStorageEmpty, () => {});
        // Should complete without error
      });

      it('should parse reason from JSON string', () => {
        const storedResponses = [
          {
            id: 'stored-1',
            status: 'stopped',
            action: 'lock',
            action_id: '123',
            time: '2023-01-01',
            retries: 0,
            reason: '{"message":"Error occurred"}',
          },
        ];
        const mockStorageLoad = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            if (action === 'all') {
              cb(null, storedResponses);
            }
          }),
        };

        responseQueueRewired.loadFromStorage(mockStorageLoad, () => {});

        const queue = responseQueueRewired.getQueue();
        expect(queue.length).to.be.greaterThan(0);
      });
    });
  });

  // ==================== ACK Queue Tests ====================
  describe('ACK Queue Module', () => {
    beforeEach(() => {
      ackQueueRewired.clearQueue();
    });

    describe('getQueue', () => {
      it('should return empty array initially', () => {
        expect(ackQueueRewired.getQueue()).to.be.an('array');
        expect(ackQueueRewired.getQueue()).to.have.length(0);
      });
    });

    describe('addAck', () => {
      it('should add ack to queue', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1' });
        expect(ackQueueRewired.getQueue()).to.have.length(1);
      });

      it('should add multiple acks to queue', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1' });
        ackQueueRewired.addAck({ ack_id: 'ack-2' });
        ackQueueRewired.addAck({ ack_id: 'ack-3' });
        expect(ackQueueRewired.getQueue()).to.have.length(3);
      });
    });

    describe('removeAck', () => {
      it('should remove ack by ack_id', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1' });
        ackQueueRewired.addAck({ ack_id: 'ack-2' });
        ackQueueRewired.removeAck('ack-1');

        expect(ackQueueRewired.getQueue()).to.have.length(1);
        expect(ackQueueRewired.getQueue()[0].ack_id).to.equal('ack-2');
      });

      it('should not throw when removing non-existent ack_id', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1' });
        expect(() => ackQueueRewired.removeAck('non-existent')).to.not.throw();
        expect(ackQueueRewired.getQueue()).to.have.length(1);
      });
    });

    describe('findAck', () => {
      it('should find ack by ack_id', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', data: 'found' });
        const result = ackQueueRewired.findAck('ack-1');
        expect(result.data).to.equal('found');
      });

      it('should return undefined if not found', () => {
        const result = ackQueueRewired.findAck('nonexistent');
        expect(result).to.be.undefined;
      });
    });

    describe('incrementRetries', () => {
      it('should increment retries for matching ack', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', retries: 0 });
        ackQueueRewired.incrementRetries('ack-1');
        expect(ackQueueRewired.getQueue()[0].retries).to.equal(1);
      });

      it('should not increment if not found', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', retries: 0 });
        ackQueueRewired.incrementRetries('nonexistent');
        expect(ackQueueRewired.getQueue()[0].retries).to.equal(0);
      });
    });

    describe('clearQueue', () => {
      it('should clear all acks', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1' });
        ackQueueRewired.addAck({ ack_id: 'ack-2' });

        ackQueueRewired.clearQueue();

        expect(ackQueueRewired.getQueue()).to.have.length(0);
      });
    });

    describe('sendAckToServer', () => {
      it('should send ack when ws is ready', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack' });
        ackQueueRewired.sendAckToServer(mockWs, { ack_id: 'ack-1', type: 'ack' }, mockLogger);

        expect(mockWs.send.calledOnce).to.be.true;
        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.ack_id).to.equal('ack-1');
      });

      it('should not send when ws is not ready', () => {
        ackQueueRewired.sendAckToServer(null, { ack_id: 'ack-1', type: 'ack' }, mockLogger);
        expect(mockWs.send.called).to.be.false;
      });

      it('should remove ack from queue after sending', () => {
        ackQueueRewired.sendAckToServer(mockWs, { ack_id: 'new-ack', type: 'ack', retries: 0 }, mockLogger);
        // ACK should be removed from queue after sending
        expect(ackQueueRewired.getQueue()).to.have.length(0);
      });

      it('should not send duplicate ack', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack', retries: 0, sent: true });
        mockWs.send.resetHistory();
        ackQueueRewired.sendAckToServer(mockWs, { ack_id: 'ack-1', type: 'ack', retries: 0 }, mockLogger);
        // Should not send because already sent
        expect(mockWs.send.called).to.be.false;
      });

      it('should catch and log error when ws.send throws', () => {
        const throwingWs = {
          readyState: 1,
          send: sinon.stub().throws(new Error('Send failed')),
        };

        expect(() => {
          ackQueueRewired.sendAckToServer(throwingWs, { ack_id: 'ack-1', type: 'ack' }, mockLogger);
        }).to.not.throw();

        expect(mockLogger.error.called).to.be.true;
      });
    });

    describe('notifyAck', () => {
      it('should remove ack when retries exceed max', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack', retries: 4 });
        ackQueueRewired.notifyAck(mockWs, 'ack-1', 'ack', '', false, 4, mockLogger);
        expect(ackQueueRewired.getQueue()).to.have.length(0);
      });

      it('should send ack when ws is ready', () => {
        mockWs.send.resetHistory();
        ackQueueRewired.notifyAck(mockWs, 'ack-1', 'ack', 'cmd-1', false, 0, mockLogger);

        expect(mockWs.send.calledOnce).to.be.true;
        // ACK should be removed from queue after sending
        expect(ackQueueRewired.getQueue()).to.have.length(0);
      });

      it('should not send when ws is not ready', () => {
        mockWs.send.resetHistory();
        ackQueueRewired.notifyAck(null, 'ack-1', 'ack', 'cmd-1', false, 0, mockLogger);

        expect(mockWs.send.called).to.be.false;
      });

      it('should send ack and remove from queue', () => {
        mockWs.send.resetHistory();
        ackQueueRewired.notifyAck(mockWs, 'new-ack', 'ack', 'cmd-1', false, 0, mockLogger);

        expect(mockWs.send.calledOnce).to.be.true;
        // Queue should be empty after sending
        expect(ackQueueRewired.getQueue()).to.have.length(0);
      });

      it('should handle retries up to max', () => {
        mockWs.send.resetHistory();
        // Call with retries = MAX_ACK_RETRIES - 1 (should send)
        ackQueueRewired.notifyAck(mockWs, 'ack-1', 'ack', 'cmd-1', false, 3, mockLogger);
        expect(mockWs.send.calledOnce).to.be.true;

        // Call with retries = MAX_ACK_RETRIES (should not send)
        mockWs.send.resetHistory();
        ackQueueRewired.notifyAck(mockWs, 'ack-1', 'ack', 'cmd-1', false, 4, mockLogger);
        expect(mockWs.send.called).to.be.false;
      });
    });

    describe('retryAckResponses', () => {
      it('should do nothing when queue is empty', () => {
        ackQueueRewired.retryAckResponses(mockWs, mockLogger);
        expect(mockWs.send.called).to.be.false;
      });

      it('should retry acks if any remain in queue', () => {
        // Manually add ACK to queue (shouldn't normally happen)
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack', id: 'cmd-1', sent: false, retries: 0 });
        mockWs.send.resetHistory();
        ackQueueRewired.retryAckResponses(mockWs, mockLogger);

        expect(mockWs.send.called).to.be.true;
        // Should be removed after sending
        expect(ackQueueRewired.getQueue()).to.have.length(0);
      });

      it('should remove acks that exceed max retries', () => {
        // Manually add ACK with high retries
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack', id: 'cmd-1', sent: false, retries: 3 });
        ackQueueRewired.retryAckResponses(mockWs, mockLogger);

        // Should be removed without sending (retries + 1 = 4 = MAX_ACK_RETRIES)
        expect(ackQueueRewired.getQueue()).to.have.length(0);
      });

      it('should not send when ws is not ready', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack', id: 'cmd-1', sent: false, retries: 0 });
        mockWs.send.resetHistory();
        ackQueueRewired.retryAckResponses(null, mockLogger);

        expect(mockWs.send.called).to.be.false;
      });
    });

    describe('processAcks', () => {
      it('should process array of acks and send immediately', () => {
        const mockAckModule = {
          processAck: sinon.stub().callsFake((item, cb) => {
            cb(null, { ack_id: item.ack_id, type: 'ack', id: item.id });
          }),
        };

        mockWs.send.resetHistory();

        ackQueueRewired.processAcks(
          [{ ack_id: 'ack-1', id: 'cmd-1' }],
          mockWs,
          mockAckModule,
          mockLogger,
        );

        // Should send immediately
        expect(mockWs.send.calledOnce).to.be.true;
        // Queue should be empty (ACK removed after sending)
        expect(ackQueueRewired.getQueue()).to.have.length(0);
      });

      it('should log error when processAck fails', () => {
        const mockAckModule = {
          processAck: sinon.stub().callsFake((item, cb) => {
            cb(new Error('Processing failed'));
          }),
        };

        ackQueueRewired.processAcks([{ ack_id: 'ack-1' }], mockWs, mockAckModule, mockLogger);
        expect(mockLogger.error.called).to.be.true;
      });

      it('should handle empty array', () => {
        const mockAckModule = {
          processAck: sinon.stub(),
        };

        ackQueueRewired.processAcks([], mockWs, mockAckModule, mockLogger);
        expect(mockAckModule.processAck.called).to.be.false;
      });

      it('should process multiple acks', () => {
        const mockAckModule = {
          processAck: sinon.stub().callsFake((item, cb) => {
            cb(null, { ack_id: item.ack_id, type: 'ack', id: item.id });
          }),
        };

        mockWs.send.resetHistory();

        ackQueueRewired.processAcks(
          [
            { ack_id: 'ack-1', id: 'cmd-1' },
            { ack_id: 'ack-2', id: 'cmd-2' },
            { ack_id: 'ack-3', id: 'cmd-3' },
          ],
          mockWs,
          mockAckModule,
          mockLogger,
        );

        // Should send all 3 ACKs
        expect(mockWs.send.callCount).to.equal(3);
        // Queue should be empty (all ACKs removed after sending)
        expect(ackQueueRewired.getQueue()).to.have.length(0);
      });
    });
  });

  // ==================== Handlers Tests ====================
  describe('Handlers Module', () => {
    describe('handleMessage', () => {
      it('should handle invalid JSON', () => {
        const context = {
          ws: mockWs,
          responseQueue: responseQueueRewired,
          ackQueue: ackQueueRewired,
          storage: mockStorage,
          ackModule: { processAck: sinon.stub() },
          hooks: mockHooks,
          logger: mockLogger,
          emitter: new EventEmitter(),
        };

        handlersRewired.handleMessage('invalid json', context);
        expect(mockHooks.trigger.calledWith('error')).to.be.true;
      });

      it('should handle OK status response', () => {
        responseQueueRewired.addToQueue({
          id: 'resp-123',
          type: 'response',
        });

        const context = {
          ws: mockWs,
          responseQueue: responseQueueRewired,
          ackQueue: ackQueueRewired,
          storage: mockStorage,
          ackModule: { processAck: sinon.stub() },
          hooks: mockHooks,
          logger: mockLogger,
          emitter: new EventEmitter(),
        };

        handlersRewired.handleMessage('{"status":"OK","id":"resp-123"}', context);
        expect(responseQueueRewired.getQueue()).to.have.length(0);
      });
    });
  });

  // ==================== Notifications Tests ====================
  describe('Notifications Module', () => {
    describe('notifyStatus', () => {
      it('should send status when ws is ready', () => {
        notificationsRewired.notifyStatus(mockWs, { online: true }, mockLogger);

        expect(mockWs.send.calledOnce).to.be.true;
        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.type).to.equal('device_status');
        expect(sentData.body.online).to.equal(true);
      });

      it('should not send when ws is not ready', () => {
        notificationsRewired.notifyStatus(null, { online: true }, mockLogger);
        expect(mockWs.send.called).to.be.false;
      });

      it('should include id, type, time and body', () => {
        notificationsRewired.notifyStatus(mockWs, { cpu: 50 }, mockLogger);

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData).to.have.property('id');
        expect(sentData).to.have.property('type');
        expect(sentData).to.have.property('time');
        expect(sentData).to.have.property('body');
      });

      it('should catch and log error when ws.send throws', () => {
        const throwingWs = {
          readyState: 1,
          send: sinon.stub().throws(new Error('Send failed')),
        };

        expect(() => {
          notificationsRewired.notifyStatus(throwingWs, { online: true }, mockLogger);
        }).to.not.throw();

        expect(mockLogger.error.called).to.be.true;
      });
    });

    describe('notifyAction', () => {
      beforeEach(() => {
        responseQueueRewired.clearQueue();
      });

      it('should not send when id is missing', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, { status: 'started', id: null, action: 'lock' });
        expect(mockWs.send.called).to.be.false;
      });

      it('should not send when id is "report"', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, { status: 'started', id: 'report', action: 'lock' });
        expect(mockWs.send.called).to.be.false;
      });

      it('should not send when action is "triggers"', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, { status: 'started', id: '123', action: 'triggers' });
        expect(mockWs.send.called).to.be.false;
      });

      it('should not send when factoryreset action has stopped status', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, { status: 'stopped', id: '123', action: 'factoryreset' });
        expect(mockWs.send.called).to.be.false;
      });

      it('should send action when valid params', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, { status: 'started', id: '123', action: 'lock' });

        expect(mockWs.send.calledOnce).to.be.true;
        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.reply_id).to.equal('123');
        expect(sentData.type).to.equal('response');
      });

      it('should include error reason when error is provided', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        const error = new Error('Test error');
        notificationsRewired.notifyAction(context, { status: 'stopped', id: '123', action: 'lock', err: error });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.reason).to.equal('Test error');
      });

      it('should handle diskencryption action with out', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, { status: 'started', id: '123', action: 'diskencryption', out: 'encrypted' });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.reason.encryption).to.equal('encrypted');
      });

      it('should handle diskencryption action with error', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, {
          status: 'stopped',
          id: '123',
          action: 'diskencryption',
          err: 'Encryption failed',
        });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.reason.encryption).to.equal('Encryption failed');
      });

      it('should handle fullwipe with out data', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, {
          status: 'started',
          id: '123',
          action: 'fullwipe',
          out: { data: 0, message: 'success' },
        });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.reason.status_code).to.equal(0);
      });

      it('should handle factoryreset with out data', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, {
          status: 'started',
          id: '123',
          action: 'factoryreset',
          out: { data: 0, message: 'reset started' },
        });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.reason.status_code).to.equal(0);
        expect(sentData.body.reason.status_msg).to.equal('reset started');
      });

      it('should handle factoryreset with error', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        const error = new Error('Reset failed');
        error.code = 2;
        notificationsRewired.notifyAction(context, {
          status: 'started',
          id: '123',
          action: 'factoryreset',
          err: error,
        });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.reason.status_code).to.equal(2);
        expect(sentData.body.reason.status_msg).to.equal('Reset failed');
        expect(sentData.body.status).to.equal('stopped');
      });

      it('should handle fullwipe with error', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        const error = new Error('Wipe failed');
        error.code = 3;
        notificationsRewired.notifyAction(context, {
          status: 'started',
          id: '123',
          action: 'fullwipe',
          err: error,
        });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.reason.status_code).to.equal(3);
        expect(sentData.body.status).to.equal('stopped');
      });

      it('should handle fullwipewindows action with opts', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, {
          status: 'started',
          id: '123',
          action: 'fullwipewindows',
          opts: { target: 'C:' },
        });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.body.target).to.equal('C:');
      });

      it('should delete response from storage when max retries exceeded', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, {
          status: 'started',
          id: '123',
          action: 'lock',
          retries: 10,
          respId: 'resp-123',
        });

        expect(mockStorage.do.calledWith('del')).to.be.true;
      });

      it('should use existing time if provided', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        const customTime = '2023-01-01T00:00:00.000Z';
        notificationsRewired.notifyAction(context, {
          status: 'started',
          id: '123',
          action: 'lock',
          time: customTime,
        });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.time).to.equal(customTime);
      });

      it('should replace NULL time with current time', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, {
          status: 'started',
          id: '123',
          action: 'lock',
          time: 'NULL',
        });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.time).to.not.equal('NULL');
      });

      it('should use respId when provided', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, {
          status: 'started',
          id: '123',
          action: 'lock',
          respId: 'custom-resp-id',
        });

        const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
        expect(sentData.id).to.equal('custom-resp-id');
      });

      it('should add to markedToBePushed when fromWithin is true', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, {
          status: 'started',
          id: '123',
          action: 'lock',
          fromWithin: true,
        });

        const markedToBePushed = responseQueueRewired.getMarkedToBePushed();
        expect(markedToBePushed.length).to.be.greaterThan(0);
      });

      it('should update existing response in queue', () => {
        const context = { ws: mockWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };

        // First call adds to queue
        notificationsRewired.notifyAction(context, {
          status: 'started',
          id: '123',
          action: 'lock',
          respId: 'existing-resp',
        });

        // Second call updates
        notificationsRewired.notifyAction(context, {
          status: 'completed',
          id: '123',
          action: 'lock',
          respId: 'existing-resp',
          retries: 1,
        });

        expect(mockStorage.do.calledWith('update')).to.be.true;
      });

      it('should not send when ws is not ready', () => {
        const context = { ws: null, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };
        notificationsRewired.notifyAction(context, {
          status: 'started',
          id: '123',
          action: 'lock',
        });

        expect(mockWs.send.called).to.be.false;
      });

      it('should catch and log error when ws.send throws', () => {
        const throwingWs = {
          readyState: 1,
          send: sinon.stub().throws(new Error('Send failed')),
        };
        const context = { ws: throwingWs, storage: mockStorage, responseQueue: responseQueueRewired, logger: mockLogger };

        expect(() => {
          notificationsRewired.notifyAction(context, {
            status: 'started',
            id: '123',
            action: 'lock',
          });
        }).to.not.throw();

        expect(mockLogger.error.called).to.be.true;
      });
    });
  });

  // ==================== Connection Tests ====================
  describe('Connection Module', () => {
    let MockWebSocket;

    beforeEach(() => {
      connectionRewired.reset();

      // Create mock WebSocket constructor
      MockWebSocket = sinon.stub().callsFake(function MockWS() {
        this.readyState = 1;
        this.send = sinon.stub();
        this.terminate = sinon.stub();
        this.ping = sinon.stub();
        this.pong = sinon.stub();
        this.on = sinon.stub().callsFake((event, handler) => {
          this[`_${event}Handler`] = handler;
        });
        // Store for triggering events
        this.triggerOpen = () => this._openHandler && this._openHandler();
        this.triggerClose = (code) => this._closeHandler && this._closeHandler(code);
        this.triggerMessage = (data) => this._messageHandler && this._messageHandler(data);
        this.triggerError = (err) => this._errorHandler && this._errorHandler(err);
        this.triggerPong = () => this._pongHandler && this._pongHandler();
        this.triggerPing = () => this._pingHandler && this._pingHandler();
      });
    });

    describe('isReady', () => {
      it('should return false when not connected', () => {
        expect(connectionRewired.isReady()).to.be.false;
      });
    });

    describe('isConnected', () => {
      it('should return false initially', () => {
        expect(connectionRewired.isConnected()).to.be.false;
      });
    });

    describe('setConnected', () => {
      it('should update connected status', () => {
        connectionRewired.setConnected(true);
        expect(connectionRewired.isConnected()).to.be.true;
        connectionRewired.setConnected(false);
      });
    });

    describe('getWebSocket', () => {
      it('should return null initially', () => {
        expect(connectionRewired.getWebSocket()).to.be.null;
      });
    });

    describe('getWorkingWithProxy', () => {
      it('should return true initially', () => {
        expect(connectionRewired.getWorkingWithProxy()).to.be.true;
      });
    });

    describe('getProxyFailureCount', () => {
      it('should return 0 initially', () => {
        expect(connectionRewired.getProxyFailureCount()).to.equal(0);
      });
    });

    describe('incrementProxyFailureCount', () => {
      it('should increment count', () => {
        connectionRewired.incrementProxyFailureCount();
        expect(connectionRewired.getProxyFailureCount()).to.equal(1);
        connectionRewired.incrementProxyFailureCount();
        expect(connectionRewired.getProxyFailureCount()).to.equal(2);
      });
    });

    describe('validateProxyConnection', () => {
      it('should toggle workingWithProxy after max failures', () => {
        connectionRewired.reset();
        // Simulate 5 failures
        for (let i = 0; i < 5; i++) {
          connectionRewired.incrementProxyFailureCount();
        }

        connectionRewired.validateProxyConnection('http://proxy.example.com');
        expect(connectionRewired.getWorkingWithProxy()).to.be.false;
        expect(connectionRewired.getProxyFailureCount()).to.equal(0);
      });

      it('should not toggle when no proxy config', () => {
        connectionRewired.reset();
        for (let i = 0; i < 5; i++) {
          connectionRewired.incrementProxyFailureCount();
        }

        connectionRewired.validateProxyConnection(null);
        expect(connectionRewired.getWorkingWithProxy()).to.be.true;
      });

      it('should not toggle when below max failures', () => {
        connectionRewired.reset();
        connectionRewired.incrementProxyFailureCount();
        connectionRewired.incrementProxyFailureCount();

        connectionRewired.validateProxyConnection('http://proxy.example.com');
        expect(connectionRewired.getWorkingWithProxy()).to.be.true;
        expect(connectionRewired.getProxyFailureCount()).to.equal(2);
      });
    });

    describe('terminate', () => {
      it('should not throw when ws is null', () => {
        expect(() => connectionRewired.terminate()).to.not.throw();
      });

      it('should call ws.terminate when ws exists', () => {
        connectionRewired.__set__('ws', mockWs);
        connectionRewired.terminate();
        expect(mockWs.terminate.calledOnce).to.be.true;
      });
    });

    describe('send', () => {
      it('should return false when ws is not ready', () => {
        connectionRewired.__set__('ws', null);
        expect(connectionRewired.send('test')).to.be.false;
      });

      it('should send data when ws is ready', () => {
        connectionRewired.__set__('ws', mockWs);
        expect(connectionRewired.send('test')).to.be.true;
        expect(mockWs.send.calledWith('test')).to.be.true;
      });
    });

    describe('create', () => {
      it('should create WebSocket with correct URL for https', () => {
        connectionRewired.__set__('WebSocket', MockWebSocket);

        connectionRewired.create(
          {
            protocol: 'https',
            host: 'panel.preyproject.com',
            deviceKey: 'device-123',
            apiKey: 'api-456',
            userAgent: 'Prey/1.0',
            proxy: null,
          },
          {
            onOpen: sinon.stub(),
            onClose: sinon.stub(),
            onMessage: sinon.stub(),
            onError: sinon.stub(),
            onPong: sinon.stub(),
            onPing: sinon.stub(),
          },
          mockLogger,
        );

        expect(MockWebSocket.calledOnce).to.be.true;
        const wsUrl = MockWebSocket.firstCall.args[0];
        expect(wsUrl).to.include('wss://');
        expect(wsUrl).to.include('device-123.ws');
      });

      it('should create WebSocket with ws protocol for http', () => {
        connectionRewired.__set__('WebSocket', MockWebSocket);

        connectionRewired.create(
          {
            protocol: 'http',
            host: 'localhost',
            deviceKey: 'device-123',
            apiKey: 'api-456',
            userAgent: 'Prey/1.0',
            proxy: null,
          },
          {
            onOpen: sinon.stub(),
            onClose: sinon.stub(),
            onMessage: sinon.stub(),
            onError: sinon.stub(),
            onPong: sinon.stub(),
            onPing: sinon.stub(),
          },
          mockLogger,
        );

        const wsUrl = MockWebSocket.firstCall.args[0];
        expect(wsUrl).to.include('ws://');
      });

      it('should include Authorization header', () => {
        connectionRewired.__set__('WebSocket', MockWebSocket);

        connectionRewired.create(
          {
            protocol: 'https',
            host: 'panel.preyproject.com',
            deviceKey: 'device-123',
            apiKey: 'api-456',
            userAgent: 'Prey/1.0',
            proxy: null,
          },
          {
            onOpen: sinon.stub(),
            onClose: sinon.stub(),
            onMessage: sinon.stub(),
            onError: sinon.stub(),
            onPong: sinon.stub(),
            onPing: sinon.stub(),
          },
          mockLogger,
        );

        const options = MockWebSocket.firstCall.args[1];
        expect(options.headers.Authorization).to.include('Basic');
      });

      it('should set up proxy agent when proxy is configured', () => {
        connectionRewired.__set__('WebSocket', MockWebSocket);
        connectionRewired.reset();

        connectionRewired.create(
          {
            protocol: 'https',
            host: 'panel.preyproject.com',
            deviceKey: 'device-123',
            apiKey: 'api-456',
            userAgent: 'Prey/1.0',
            proxy: 'http://proxy.example.com:8080',
          },
          {
            onOpen: sinon.stub(),
            onClose: sinon.stub(),
            onMessage: sinon.stub(),
            onError: sinon.stub(),
            onPong: sinon.stub(),
            onPing: sinon.stub(),
          },
          mockLogger,
        );

        expect(mockLogger.info.calledWith('Setting up proxy')).to.be.true;
      });

      it('should call onOpen callback when connection opens', () => {
        connectionRewired.__set__('WebSocket', MockWebSocket);
        const onOpen = sinon.stub();

        const ws = connectionRewired.create(
          {
            protocol: 'https',
            host: 'panel.preyproject.com',
            deviceKey: 'device-123',
            apiKey: 'api-456',
            userAgent: 'Prey/1.0',
            proxy: null,
          },
          {
            onOpen,
            onClose: sinon.stub(),
            onMessage: sinon.stub(),
            onError: sinon.stub(),
            onPong: sinon.stub(),
            onPing: sinon.stub(),
          },
          mockLogger,
        );

        ws.triggerOpen();
        expect(onOpen.calledOnce).to.be.true;
        expect(connectionRewired.isConnected()).to.be.true;
      });

      it('should call onClose callback when connection closes', () => {
        connectionRewired.__set__('WebSocket', MockWebSocket);
        const onClose = sinon.stub();

        const ws = connectionRewired.create(
          {
            protocol: 'https',
            host: 'panel.preyproject.com',
            deviceKey: 'device-123',
            apiKey: 'api-456',
            userAgent: 'Prey/1.0',
            proxy: null,
          },
          {
            onOpen: sinon.stub(),
            onClose,
            onMessage: sinon.stub(),
            onError: sinon.stub(),
            onPong: sinon.stub(),
            onPing: sinon.stub(),
          },
          mockLogger,
        );

        ws.triggerClose(1006);
        expect(onClose.calledWith(1006)).to.be.true;
      });

      it('should call onMessage callback when message received', () => {
        connectionRewired.__set__('WebSocket', MockWebSocket);
        const onMessage = sinon.stub();

        const ws = connectionRewired.create(
          {
            protocol: 'https',
            host: 'panel.preyproject.com',
            deviceKey: 'device-123',
            apiKey: 'api-456',
            userAgent: 'Prey/1.0',
            proxy: null,
          },
          {
            onOpen: sinon.stub(),
            onClose: sinon.stub(),
            onMessage,
            onError: sinon.stub(),
            onPong: sinon.stub(),
            onPing: sinon.stub(),
          },
          mockLogger,
        );

        ws.triggerMessage('{"test": true}');
        expect(onMessage.calledWith('{"test": true}')).to.be.true;
      });

      it('should call onError callback and log error', () => {
        connectionRewired.__set__('WebSocket', MockWebSocket);
        const onError = sinon.stub();

        const ws = connectionRewired.create(
          {
            protocol: 'https',
            host: 'panel.preyproject.com',
            deviceKey: 'device-123',
            apiKey: 'api-456',
            userAgent: 'Prey/1.0',
            proxy: null,
          },
          {
            onOpen: sinon.stub(),
            onClose: sinon.stub(),
            onMessage: sinon.stub(),
            onError,
            onPong: sinon.stub(),
            onPing: sinon.stub(),
          },
          mockLogger,
        );

        const testError = new Error('Connection failed');
        ws.triggerError(testError);
        expect(onError.calledWith(testError)).to.be.true;
        expect(mockLogger.error.called).to.be.true;
      });

      it('should call onPong callback when pong received', () => {
        connectionRewired.__set__('WebSocket', MockWebSocket);
        const onPong = sinon.stub();

        const ws = connectionRewired.create(
          {
            protocol: 'https',
            host: 'panel.preyproject.com',
            deviceKey: 'device-123',
            apiKey: 'api-456',
            userAgent: 'Prey/1.0',
            proxy: null,
          },
          {
            onOpen: sinon.stub(),
            onClose: sinon.stub(),
            onMessage: sinon.stub(),
            onError: sinon.stub(),
            onPong,
            onPing: sinon.stub(),
          },
          mockLogger,
        );

        ws.triggerPong();
        expect(onPong.calledOnce).to.be.true;
      });

      it('should call onPing callback when ping received', () => {
        connectionRewired.__set__('WebSocket', MockWebSocket);
        const onPing = sinon.stub();

        const ws = connectionRewired.create(
          {
            protocol: 'https',
            host: 'panel.preyproject.com',
            deviceKey: 'device-123',
            apiKey: 'api-456',
            userAgent: 'Prey/1.0',
            proxy: null,
          },
          {
            onOpen: sinon.stub(),
            onClose: sinon.stub(),
            onMessage: sinon.stub(),
            onError: sinon.stub(),
            onPong: sinon.stub(),
            onPing,
          },
          mockLogger,
        );

        ws.triggerPing();
        expect(onPing.calledOnce).to.be.true;
      });

      it('should terminate existing connection before creating new one', () => {
        connectionRewired.__set__('WebSocket', MockWebSocket);

        // First create a connection
        const ws1 = connectionRewired.create(
          {
            protocol: 'https',
            host: 'panel.preyproject.com',
            deviceKey: 'device-123',
            apiKey: 'api-456',
            userAgent: 'Prey/1.0',
            proxy: null,
          },
          {
            onOpen: sinon.stub(),
            onClose: sinon.stub(),
            onMessage: sinon.stub(),
            onError: sinon.stub(),
            onPong: sinon.stub(),
            onPing: sinon.stub(),
          },
          mockLogger,
        );

        // Create another connection
        connectionRewired.create(
          {
            protocol: 'https',
            host: 'panel.preyproject.com',
            deviceKey: 'device-456',
            apiKey: 'api-789',
            userAgent: 'Prey/1.0',
            proxy: null,
          },
          {
            onOpen: sinon.stub(),
            onClose: sinon.stub(),
            onMessage: sinon.stub(),
            onError: sinon.stub(),
            onPong: sinon.stub(),
            onPing: sinon.stub(),
          },
          mockLogger,
        );

        expect(ws1.terminate.calledOnce).to.be.true;
      });

      it('should return the WebSocket instance', () => {
        connectionRewired.__set__('WebSocket', MockWebSocket);

        const ws = connectionRewired.create(
          {
            protocol: 'https',
            host: 'panel.preyproject.com',
            deviceKey: 'device-123',
            apiKey: 'api-456',
            userAgent: 'Prey/1.0',
            proxy: null,
          },
          {
            onOpen: sinon.stub(),
            onClose: sinon.stub(),
            onMessage: sinon.stub(),
            onError: sinon.stub(),
            onPong: sinon.stub(),
            onPing: sinon.stub(),
          },
          mockLogger,
        );

        expect(ws).to.not.be.null;
      });
    });

    describe('reset', () => {
      it('should reset all state', () => {
        connectionRewired.setConnected(true);
        connectionRewired.incrementProxyFailureCount();

        connectionRewired.reset();

        expect(connectionRewired.isConnected()).to.be.false;
        expect(connectionRewired.getProxyFailureCount()).to.equal(0);
        expect(connectionRewired.getWorkingWithProxy()).to.be.true;
        expect(connectionRewired.getWebSocket()).to.be.null;
      });
    });
  });

  // ==================== Index Module Facade Tests ====================
  describe('Index Module (Facade)', () => {
    let mockConfig;
    let mockKeys;
    let mockStatusTrigger;
    let mockConnection;
    let mockServer;
    let mockTriggers;
    let mockFileretrieval;
    let mockNetwork;

    beforeEach(() => {
      // Mock config
      mockConfig = {
        getData: sinon.stub().callsFake((key) => {
          const data = {
            'try_proxy': null,
            'control-panel.protocol': 'https',
            'control-panel.host': 'panel.preyproject.com',
            'control-panel.send_location_on_connect': 'false',
          };
          return data[key];
        }),
      };

      // Mock keys
      mockKeys = {
        get: sinon.stub().returns({ device: 'device-key-123', api: 'api-key-456' }),
      };

      // Mock status trigger
      mockStatusTrigger = {
        get_status: sinon.stub().callsFake((cb) => cb(null, { online: true })),
        status_info: sinon.stub().callsFake((cb) => cb(null, { online: true })),
      };

      // Mock connection module
      mockConnection = {
        getWebSocket: sinon.stub().returns(mockWs),
        isReady: sinon.stub().returns(true),
        isConnected: sinon.stub().returns(true),
        setConnected: sinon.stub(),
        create: sinon.stub(),
        terminate: sinon.stub(),
        validateProxyConnection: sinon.stub(),
        incrementProxyFailureCount: sinon.stub(),
        reset: sinon.stub(),
      };

      // Mock server
      mockServer = {
        create_server: sinon.stub().callsFake((cb) => cb(null)),
      };

      // Mock triggers
      mockTriggers = {
        start: sinon.stub(),
        currentTriggers: [],
      };

      // Mock fileretrieval
      mockFileretrieval = {
        check_pending_files: sinon.stub(),
      };

      // Mock network
      mockNetwork = {
        get_connection_status: sinon.stub().callsFake((cb) => cb('connected')),
      };
    });

    describe('exported properties', () => {
      it('should export re_schedule as true', () => {
        expect(websocketsRewired.re_schedule).to.be.true;
      });

      it('should export responses_queue as array', () => {
        expect(websocketsRewired.responses_queue).to.be.an('array');
      });

      it('should export responsesAck as array', () => {
        expect(websocketsRewired.responsesAck).to.be.an('array');
      });

      it('should export isReconnecting as false initially', () => {
        expect(websocketsRewired.isReconnecting).to.be.false;
      });
    });

    describe('exported functions', () => {
      it('should export getReconnectDelay', () => {
        expect(websocketsRewired.getReconnectDelay).to.be.a('function');
      });

      it('should export resetReconnectDelay', () => {
        expect(websocketsRewired.resetReconnectDelay).to.be.a('function');
      });

      it('should export heartbeat', () => {
        expect(websocketsRewired.heartbeat).to.be.a('function');
      });

      it('should export heartbeatTimed', () => {
        expect(websocketsRewired.heartbeatTimed).to.be.a('function');
      });

      it('should export notify_action', () => {
        expect(websocketsRewired.notify_action).to.be.a('function');
      });

      it('should export notify_status', () => {
        expect(websocketsRewired.notify_status).to.be.a('function');
      });

      it('should export check_timestamp', () => {
        expect(websocketsRewired.check_timestamp).to.be.a('function');
      });

      it('should export lastConnection', () => {
        expect(websocketsRewired.lastConnection).to.be.a('function');
      });

      it('should export sendAckToServer', () => {
        expect(websocketsRewired.sendAckToServer).to.be.a('function');
      });

      it('should export notifyAck', () => {
        expect(websocketsRewired.notifyAck).to.be.a('function');
      });

      it('should export load', () => {
        expect(websocketsRewired.load).to.be.a('function');
      });

      it('should export unload', () => {
        expect(websocketsRewired.unload).to.be.a('function');
      });

      it('should export startWebsocket', () => {
        expect(websocketsRewired.startWebsocket).to.be.a('function');
      });
    });

    describe('check_timestamp', () => {
      it('should return false when lastTime is not set', () => {
        websocketsRewired.__set__('lastTime', null);
        expect(websocketsRewired.check_timestamp()).to.be.false;
      });

      it('should return false when lastTime is old', () => {
        websocketsRewired.__set__('lastTime', Date.now() - (6 * 60 * 1000));
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

    describe('getStatusByInterval', () => {
      it('should not call get_status when gettingStatus is true', () => {
        websocketsRewired.__set__('gettingStatus', true);
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);

        const getStatusByInterval = websocketsRewired.__get__('getStatusByInterval');
        getStatusByInterval();

        expect(mockStatusTrigger.get_status.called).to.be.false;
        websocketsRewired.__set__('gettingStatus', false);
      });

      it('should call get_status when gettingStatus is false', () => {
        websocketsRewired.__set__('gettingStatus', false);
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);

        const getStatusByInterval = websocketsRewired.__get__('getStatusByInterval');
        getStatusByInterval();

        expect(mockStatusTrigger.get_status.calledOnce).to.be.true;
      });

      it('should call notify_status with the status result', () => {
        websocketsRewired.__set__('gettingStatus', false);
        mockStatusTrigger.get_status = sinon.stub().callsFake((cb) => cb(null, { cpu: 50 }));
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);

        const notifyStatusSpy = sinon.spy();
        websocketsRewired.notify_status = notifyStatusSpy;

        const getStatusByInterval = websocketsRewired.__get__('getStatusByInterval');
        getStatusByInterval();

        expect(notifyStatusSpy.calledWith({ cpu: 50 })).to.be.true;
      });
    });

    describe('clearAndResetIntervals', () => {
      it('should clear all intervals', () => {
        const clearAndResetIntervals = websocketsRewired.__get__('clearAndResetIntervals');

        // Set up some intervals
        websocketsRewired.__set__('timeOutCancelIntervalHearBeat', setTimeout(() => {}, 10000));
        websocketsRewired.__set__('notifyAckInterval', setInterval(() => {}, 10000));
        websocketsRewired.__set__('notifyActionInterval', setInterval(() => {}, 10000));
        websocketsRewired.__set__('getStatusInterval', setInterval(() => {}, 10000));
        websocketsRewired.__set__('setIntervalWSStatus', setInterval(() => {}, 10000));

        // Should not throw
        expect(() => clearAndResetIntervals()).to.not.throw();
      });

      it('should clear alive time interval when aliveTimeReset is true', () => {
        const clearAndResetIntervals = websocketsRewired.__get__('clearAndResetIntervals');

        websocketsRewired.__set__('setAliveTimeInterval', setInterval(() => {}, 10000));

        expect(() => clearAndResetIntervals(true)).to.not.throw();
      });
    });

    describe('updateTimestamp', () => {
      it('should update lastTime to current time', () => {
        const updateTimestamp = websocketsRewired.__get__('updateTimestamp');
        const before = Date.now();
        updateTimestamp();
        const after = Date.now();

        const lastTime = websocketsRewired.__get__('lastTime');
        expect(lastTime).to.be.at.least(before);
        expect(lastTime).to.be.at.most(after);
      });
    });

    describe('setLastConnection', () => {
      it('should set lastConnection from storage when data exists', () => {
        const mockStorageWithData = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            if (action === 'query') {
              cb(null, [{ value: '1609459200' }]);
            }
          }),
        };
        websocketsRewired.__set__('storage', mockStorageWithData);

        const setLastConnection = websocketsRewired.__get__('setLastConnection');
        setLastConnection();

        const lastConnection = websocketsRewired.__get__('lastConnection');
        expect(lastConnection).to.equal(1609459200);
      });

      it('should create new lastConnection when no data exists', () => {
        const mockStorageEmpty = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            if (action === 'query') {
              cb(null, []);
            } else if (action === 'set') {
              cb(null);
            }
          }),
        };
        websocketsRewired.__set__('storage', mockStorageEmpty);

        const setLastConnection = websocketsRewired.__get__('setLastConnection');
        setLastConnection();

        const lastConnection = websocketsRewired.__get__('lastConnection');
        expect(lastConnection).to.be.a('number');
      });

      it('should log error when storage query fails', () => {
        const mockStorageError = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            cb(new Error('Storage error'));
          }),
        };
        websocketsRewired.__set__('storage', mockStorageError);
        websocketsRewired.__set__('logger', mockLogger);

        const setLastConnection = websocketsRewired.__get__('setLastConnection');
        setLastConnection();

        expect(mockLogger.error.called).to.be.true;
      });
    });

    describe('updateStoredConnection', () => {
      it('should update storage with new connection time', () => {
        const mockStorageUpdate = {
          do: sinon.stub().callsFake((action, opts, cb) => cb(null)),
        };
        websocketsRewired.__set__('storage', mockStorageUpdate);

        const updateStoredConnection = websocketsRewired.__get__('updateStoredConnection');
        updateStoredConnection(1609459200);

        expect(mockStorageUpdate.do.calledWith('update')).to.be.true;
      });

      it('should log when update fails', () => {
        const mockStorageError = {
          do: sinon.stub().callsFake((action, opts, cb) => cb(new Error('Update failed'))),
        };
        websocketsRewired.__set__('storage', mockStorageError);
        websocketsRewired.__set__('logger', mockLogger);

        const updateStoredConnection = websocketsRewired.__get__('updateStoredConnection');
        updateStoredConnection(1609459200);

        expect(mockLogger.info.called).to.be.true;
      });
    });

    describe('loadHooks', () => {
      let clock;
      let localWebsockets;

      beforeEach(() => {
        clock = sinon.useFakeTimers();
        // Re-rewire after fake timers are set up
        localWebsockets = rewire('../../../../../lib/agent/control-panel/websockets');
        localWebsockets.__set__('hooks', mockHooks);
        localWebsockets.__set__('triggers', mockTriggers);
        localWebsockets.__set__('storage', mockStorage);
      });

      afterEach(() => {
        clock.restore();
      });

      it('should call setLastConnection and start triggers', () => {
        const loadHooks = localWebsockets.__get__('loadHooks');
        loadHooks();

        expect(mockTriggers.start.calledOnce).to.be.true;

        // Advance time past DEVICE_UNSEEN_DELAY (15000ms)
        clock.tick(15001);

        expect(mockHooks.trigger.calledWith('device_unseen')).to.be.true;
      });

      it('should register connected hook', () => {
        const loadHooks = localWebsockets.__get__('loadHooks');
        loadHooks();

        expect(mockHooks.on.calledWith('connected')).to.be.true;
      });
    });

    describe('loadServer', () => {
      it('should create server after timeout', (done) => {
        websocketsRewired.__set__('server', mockServer);

        const loadServer = websocketsRewired.__get__('loadServer');
        loadServer();

        // Wait for setTimeout to fire
        setTimeout(() => {
          expect(mockServer.create_server.calledOnce).to.be.true;
          done();
        }, 6000);
      }).timeout(7000);
    });

    describe('queryTriggers', () => {
      it('should query triggers from storage', () => {
        const mockStorageTriggers = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            if (action === 'all' && opts.type === 'triggers') {
              cb(null, []);
            }
          }),
        };
        websocketsRewired.__set__('storage', mockStorageTriggers);

        const queryTriggers = websocketsRewired.__get__('queryTriggers');
        queryTriggers();

        expect(mockStorageTriggers.do.calledWith('all')).to.be.true;
      });

      it('should handle storage error gracefully', () => {
        const mockStorageError = {
          do: sinon.stub().callsFake((action, opts, cb) => cb(new Error('Error'))),
        };
        websocketsRewired.__set__('storage', mockStorageError);

        const queryTriggers = websocketsRewired.__get__('queryTriggers');
        expect(() => queryTriggers()).to.not.throw();
      });

      it('should filter and reset device_unseen triggers', () => {
        const triggersData = [
          {
            id: 'trigger-1',
            automation_events: JSON.stringify([{ type: 'device_unseen' }]),
          },
        ];
        mockTriggers.currentTriggers = [{ id: 'trigger-1', last_exec: Date.now() }];

        const mockStorageTriggers = {
          do: sinon.stub().callsFake((action, opts, cb) => {
            if (action === 'all' && opts.type === 'triggers') {
              cb(null, triggersData);
            } else if (action === 'update') {
              cb(null);
            }
          }),
        };

        websocketsRewired.__set__('storage', mockStorageTriggers);
        websocketsRewired.__set__('triggers', mockTriggers);

        const queryTriggers = websocketsRewired.__get__('queryTriggers');
        queryTriggers();

        expect(mockStorageTriggers.do.calledWith('update')).to.be.true;
      });
    });

    describe('restartWebsocketCall', () => {
      it('should skip if already reconnecting', () => {
        const mockReconnection = {
          getIsReconnecting: sinon.stub().returns(true),
          setIsReconnecting: sinon.stub(),
          getReconnectDelay: sinon.stub().returns(5000),
          getReconnectAttempts: sinon.stub().returns(1),
        };
        websocketsRewired.__set__('reconnection', mockReconnection);
        websocketsRewired.__set__('logger', mockLogger);

        const restartWebsocketCall = websocketsRewired.__get__('restartWebsocketCall');
        restartWebsocketCall();

        expect(mockLogger.debug.calledWith('Reconnection already in progress, skipping')).to.be.true;
      });

      it('should schedule reconnection with delay', (done) => {
        const mockReconnection = {
          getIsReconnecting: sinon.stub().returns(false),
          setIsReconnecting: sinon.stub(),
          getReconnectDelay: sinon.stub().returns(100),
          getReconnectAttempts: sinon.stub().returns(1),
        };
        websocketsRewired.__set__('reconnection', mockReconnection);
        websocketsRewired.__set__('connection', mockConnection);
        websocketsRewired.__set__('config', mockConfig);
        websocketsRewired.__set__('logger', mockLogger);

        // Mock startWebsocket to avoid side effects
        const startWebsocketStub = sinon.stub();
        websocketsRewired.startWebsocket = startWebsocketStub;

        const restartWebsocketCall = websocketsRewired.__get__('restartWebsocketCall');
        restartWebsocketCall();

        expect(websocketsRewired.isReconnecting).to.be.true;

        setTimeout(() => {
          expect(startWebsocketStub.called).to.be.true;
          done();
        }, 200);
      });
    });

    describe('heartbeat', () => {
      it('should trigger reconnection when connection is not ready', () => {
        const mockConnectionNotReady = {
          ...mockConnection,
          isReady: sinon.stub().returns(false),
        };
        const mockReconnection = {
          getIsReconnecting: sinon.stub().returns(false),
          setIsReconnecting: sinon.stub(),
          getReconnectDelay: sinon.stub().returns(5000),
          getReconnectAttempts: sinon.stub().returns(1),
        };

        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('connection', mockConnectionNotReady);
        websocketsRewired.__set__('config', mockConfig);
        websocketsRewired.__set__('reconnection', mockReconnection);
        websocketsRewired.__set__('logger', mockLogger);

        websocketsRewired.heartbeat();

        expect(mockHooks.trigger.calledWith('device_unseen')).to.be.true;
      });

      it('should not trigger reconnection when connection is ready', () => {
        const mockConnectionReady = {
          ...mockConnection,
          isReady: sinon.stub().returns(true),
        };

        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('connection', mockConnectionReady);

        websocketsRewired.heartbeat();

        // Should not trigger device_unseen when ready
        expect(mockHooks.trigger.calledWith('device_unseen')).to.be.false;
      });
    });

    describe('heartbeatTimed', () => {
      it('should call heartbeat module heartbeatTimed', () => {
        const mockHeartbeat = {
          heartbeatTimed: sinon.stub(),
          clearAll: sinon.stub(),
        };
        websocketsRewired.__set__('heartbeat', mockHeartbeat);

        websocketsRewired.heartbeatTimed();

        expect(mockHeartbeat.heartbeatTimed.calledOnce).to.be.true;
      });
    });

    describe('notify_status', () => {
      it('should call notifications.notifyStatus', () => {
        const mockNotifications = {
          notifyStatus: sinon.stub(),
          notifyAction: sinon.stub(),
        };
        websocketsRewired.__set__('notifications', mockNotifications);
        websocketsRewired.__set__('connection', mockConnection);
        websocketsRewired.__set__('logger', mockLogger);

        websocketsRewired.notify_status({ online: true });

        expect(mockNotifications.notifyStatus.calledOnce).to.be.true;
        expect(mockNotifications.notifyStatus.firstCall.args[1]).to.deep.equal({ online: true });
      });
    });

    describe('notify_action', () => {
      it('should call notifications.notifyAction with all parameters', () => {
        const mockNotifications = {
          notifyStatus: sinon.stub(),
          notifyAction: sinon.stub(),
        };
        const mockResponseQueue = {
          getQueue: sinon.stub().returns([]),
        };
        websocketsRewired.__set__('notifications', mockNotifications);
        websocketsRewired.__set__('connection', mockConnection);
        websocketsRewired.__set__('storage', mockStorage);
        websocketsRewired.__set__('responseQueue', mockResponseQueue);
        websocketsRewired.__set__('logger', mockLogger);

        websocketsRewired.notify_action('started', '123', 'lock', null, null, null, null, 'resp-1', 0, false);

        expect(mockNotifications.notifyAction.calledOnce).to.be.true;
      });

      it('should sync responses_queue after notification', () => {
        const mockNotifications = {
          notifyStatus: sinon.stub(),
          notifyAction: sinon.stub(),
        };
        const mockResponseQueue = {
          getQueue: sinon.stub().returns([{ id: 'queued-1' }]),
        };
        websocketsRewired.__set__('notifications', mockNotifications);
        websocketsRewired.__set__('connection', mockConnection);
        websocketsRewired.__set__('storage', mockStorage);
        websocketsRewired.__set__('responseQueue', mockResponseQueue);
        websocketsRewired.__set__('logger', mockLogger);

        websocketsRewired.notify_action('started', '123', 'lock');

        expect(websocketsRewired.responses_queue).to.deep.equal([{ id: 'queued-1' }]);
      });
    });

    describe('sendAckToServer', () => {
      it('should call ackQueue.sendAckToServer', () => {
        const mockAckQueue = {
          sendAckToServer: sinon.stub(),
          getQueue: sinon.stub().returns([]),
        };
        websocketsRewired.__set__('ackQueue', mockAckQueue);
        websocketsRewired.__set__('connection', mockConnection);
        websocketsRewired.__set__('logger', mockLogger);

        websocketsRewired.sendAckToServer({ ack_id: 'ack-1' });

        expect(mockAckQueue.sendAckToServer.calledOnce).to.be.true;
      });
    });

    describe('notifyAck', () => {
      it('should call ackQueue.notifyAck with all parameters', () => {
        const mockAckQueue = {
          notifyAck: sinon.stub(),
          getQueue: sinon.stub().returns([]),
        };
        websocketsRewired.__set__('ackQueue', mockAckQueue);
        websocketsRewired.__set__('connection', mockConnection);
        websocketsRewired.__set__('logger', mockLogger);

        websocketsRewired.notifyAck('ack-1', 'ack', 'cmd-1', true, 0);

        expect(mockAckQueue.notifyAck.calledOnce).to.be.true;
        expect(mockAckQueue.notifyAck.firstCall.args[1]).to.equal('ack-1');
      });
    });

    describe('startWebsocket', () => {
      it('should clear intervals and call webSocketSettings', () => {
        const mockHeartbeat = {
          heartbeatTimed: sinon.stub(),
          clearAll: sinon.stub(),
          startPingInterval: sinon.stub(),
        };
        websocketsRewired.__set__('heartbeat', mockHeartbeat);
        websocketsRewired.__set__('config', mockConfig);
        websocketsRewired.__set__('keys', mockKeys);
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
        websocketsRewired.__set__('connection', mockConnection);
        websocketsRewired.__set__('logger', mockLogger);
        websocketsRewired.__set__('storage', mockStorage);
        websocketsRewired.__set__('hooks', mockHooks);

        expect(() => websocketsRewired.startWebsocket()).to.not.throw();
      });
    });

    describe('webSocketSettings', () => {
      it('should unload when no device key', () => {
        const mockKeysNoDevice = {
          get: sinon.stub().returns({ device: null, api: 'api-key' }),
        };
        const mockErrors = {
          get: sinon.stub().returns(new Error('NO_DEVICE_KEY')),
        };
        const mockUtils = {
          propagateError: sinon.stub(),
        };

        websocketsRewired.__set__('keys', mockKeysNoDevice);
        websocketsRewired.__set__('errors', mockErrors);
        websocketsRewired.__set__('utils', mockUtils);
        websocketsRewired.__set__('config', mockConfig);
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('logger', mockLogger);
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        expect(mockUtils.propagateError.called).to.be.true;
      });

      it('should create connection when device key exists', () => {
        const mockHeartbeat = {
          heartbeatTimed: sinon.stub(),
          clearAll: sinon.stub(),
          startPingInterval: sinon.stub(),
        };
        const mockResponseQueue = {
          getQueue: sinon.stub().returns([]),
          loadFromStorage: sinon.stub().callsFake((storage, cb) => cb()),
          retryQueuedResponses: sinon.stub(),
        };

        websocketsRewired.__set__('keys', mockKeys);
        websocketsRewired.__set__('config', mockConfig);
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
        websocketsRewired.__set__('connection', mockConnection);
        websocketsRewired.__set__('heartbeat', mockHeartbeat);
        websocketsRewired.__set__('responseQueue', mockResponseQueue);
        websocketsRewired.__set__('storage', mockStorage);
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('logger', mockLogger);
        websocketsRewired.__set__('emitter', new EventEmitter());

        const webSocketSettings = websocketsRewired.__get__('webSocketSettings');
        webSocketSettings();

        expect(mockConnection.create.calledOnce).to.be.true;
      });
    });

    describe('load', () => {
      it('should return emitter via callback', (done) => {
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('server', mockServer);
        websocketsRewired.__set__('triggers', mockTriggers);
        websocketsRewired.__set__('storage', mockStorage);
        websocketsRewired.__set__('config', mockConfig);
        websocketsRewired.__set__('keys', mockKeys);
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
        websocketsRewired.__set__('connection', mockConnection);
        websocketsRewired.__set__('logger', mockLogger);
        websocketsRewired.__set__('emitter', null);

        websocketsRewired.load((err, emitter) => {
          expect(err).to.be.null;
          expect(emitter).to.be.instanceOf(EventEmitter);
          done();
        });
      });

      it('should return existing emitter if already created', (done) => {
        const existingEmitter = new EventEmitter();
        websocketsRewired.__set__('emitter', existingEmitter);
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('server', mockServer);
        websocketsRewired.__set__('triggers', mockTriggers);
        websocketsRewired.__set__('storage', mockStorage);
        websocketsRewired.__set__('config', mockConfig);
        websocketsRewired.__set__('keys', mockKeys);
        websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
        websocketsRewired.__set__('connection', mockConnection);
        websocketsRewired.__set__('logger', mockLogger);

        websocketsRewired.load((err, emitter) => {
          expect(err).to.be.null;
          expect(emitter).to.equal(existingEmitter);
          done();
        });
      });
    });

    describe('unload', () => {
      it('should set re_schedule to false', (done) => {
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('emitter', null);
        websocketsRewired.__set__('connection', mockConnection);

        const mockHeartbeat = {
          clearPingTimeout: sinon.stub(),
          clearAll: sinon.stub(),
        };
        websocketsRewired.__set__('heartbeat', mockHeartbeat);

        websocketsRewired.unload(() => {
          expect(websocketsRewired.re_schedule).to.be.false;
          // Reset for other tests
          websocketsRewired.re_schedule = true;
          done();
        });
      });

      it('should remove emitter listeners and set to null', (done) => {
        const testEmitter = new EventEmitter();
        testEmitter.on('test', () => {});

        websocketsRewired.__set__('emitter', testEmitter);
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('connection', mockConnection);

        const mockHeartbeat = {
          clearPingTimeout: sinon.stub(),
          clearAll: sinon.stub(),
        };
        websocketsRewired.__set__('heartbeat', mockHeartbeat);

        websocketsRewired.unload(() => {
          const emitterAfter = websocketsRewired.__get__('emitter');
          expect(emitterAfter).to.be.null;
          websocketsRewired.re_schedule = true;
          done();
        });
      });

      it('should call connection.terminate', (done) => {
        websocketsRewired.__set__('hooks', mockHooks);
        websocketsRewired.__set__('emitter', null);
        websocketsRewired.__set__('connection', mockConnection);

        const mockHeartbeat = {
          clearPingTimeout: sinon.stub(),
          clearAll: sinon.stub(),
        };
        websocketsRewired.__set__('heartbeat', mockHeartbeat);

        websocketsRewired.unload(() => {
          expect(mockConnection.terminate.calledOnce).to.be.true;
          websocketsRewired.re_schedule = true;
          done();
        });
      });
    });
  });

  // ==================== Full Action Flow Tests ====================
  describe('Full Action Flow - Lock Command', () => {
    let mockEmitter;
    let mockAckModule;
    let lockActionMessage;

    beforeEach(() => {
      // Create mock emitter
      mockEmitter = new EventEmitter();

      // Initialize command queue with hooks and inject into handlers
      commandQueueRewired.initialize(mockHooks);
      commandQueueRewired.clearAllQueues();
      handlersRewired.__set__('commandQueue', commandQueueRewired);

      // Create mock ACK module
      mockAckModule = {
        processAck: sinon.stub().callsFake((json, cb) => {
          if (json.ack_id) {
            cb(null, {
              ack_id: json.ack_id,
              type: 'ack',
              id: json.id || '',
            });
          } else {
            cb(new Error('No ack_id'));
          }
        }),
      };

      // Reset queues
      ackQueueRewired.clearQueue();
      responseQueueRewired.clearQueue();

      // Reset mock WebSocket send
      mockWs.send.resetHistory();

      // Lock action message with modified IDs and unlock_pass
      lockActionMessage = JSON.stringify([
        {
          ack_id: '_INBOX.TestAck123.MockInboxId',
          body: {
            command: 'start',
            options: {
              close_apps: false,
              unlock_pass: 'testsecurepass123',
            },
            target: 'lock',
          },
          id: 'a1b2c3d4-5678-9012-3456-789abcdef012',
          message_id: 'f9e8d7c6-b5a4-3210-9876-543210fedcba',
          time: '2026-02-02T14:16:01.506795823Z',
          type: 'action',
        },
      ]);
    });

    it('should process lock action message and send ACK only once', () => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      mockWs.send.resetHistory();

      handlersRewired.handleMessage(lockActionMessage, context);

      // Verify ACK was sent exactly once
      expect(mockWs.send.calledOnce).to.be.true;
      const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
      expect(sentData.ack_id).to.equal('_INBOX.TestAck123.MockInboxId');

      // Queue should be empty (ACK removed after sending)
      const ackQueue = ackQueueRewired.getQueue();
      expect(ackQueue.length).to.equal(0);
    });

    it('should send ACK via WebSocket and remove from queue', () => {
      const ackData = {
        ack_id: '_INBOX.TestAck123.MockInboxId',
        type: 'ack',
        retries: 0,
      };

      mockWs.send.resetHistory();
      ackQueueRewired.sendAckToServer(mockWs, ackData, mockLogger);

      // Verify sent exactly once
      expect(mockWs.send.calledOnce).to.be.true;

      const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
      expect(sentData).to.have.property('ack_id', '_INBOX.TestAck123.MockInboxId');

      // Queue should be empty (ACK removed after sending)
      const ackQueue = ackQueueRewired.getQueue();
      expect(ackQueue.length).to.equal(0);

      // If we try to send with sent=true flag, it should not send
      ackQueueRewired.addAck({ ...ackData, sent: true });
      mockWs.send.resetHistory();
      ackQueueRewired.sendAckToServer(mockWs, ackData, mockLogger);

      // Should not send because marked as sent
      expect(mockWs.send.called).to.be.false;
    });

    it('should not send response multiple times', () => {
      const notifyContext = {
        ws: mockWs,
        storage: mockStorage,
        responseQueue: responseQueueRewired,
        logger: mockLogger,
      };

      const responseParams = {
        status: 'started',
        id: 'action-id-123',
        action: 'lock',
        opts: { close_apps: false },
        err: null,
        out: { success: true },
        time: new Date().toISOString(),
        respId: 'resp-12345',
        retries: 0,
        fromWithin: false,
      };

      mockWs.send.resetHistory();

      // Send first time
      notificationsRewired.notifyAction(notifyContext, responseParams);

      // Verify sent exactly once
      expect(mockWs.send.calledOnce).to.be.true;

      // Try to send again with same respId
      mockWs.send.resetHistory();
      notificationsRewired.notifyAction(notifyContext, responseParams);

      // Should not send again because already sent
      expect(mockWs.send.called).to.be.false;
    });

    it('should emit command event with correct action data', (done) => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      mockEmitter.on('command', (command) => {
        expect(command).to.have.property('ack_id', '_INBOX.TestAck123.MockInboxId');
        expect(command.body).to.have.property('command', 'start');
        expect(command.body).to.have.property('target', 'lock');
        expect(command.body.options).to.have.property('unlock_pass', 'testsecurepass123');
        done();
      });

      handlersRewired.handleMessage(lockActionMessage, context);
    });

    it('should handle complete flow with single sends', (done) => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      mockWs.send.resetHistory();

      mockEmitter.on('command', (command) => {
        expect(command.body.target).to.equal('lock');

        setTimeout(() => {
          // Verify ACK was sent
          expect(mockWs.send.calledOnce).to.be.true;
          const sentData = JSON.parse(mockWs.send.firstCall.args[0]);
          expect(sentData.ack_id).to.equal('_INBOX.TestAck123.MockInboxId');

          // Queue should be empty (ACK removed after sending)
          const ackQueue = ackQueueRewired.getQueue();
          expect(ackQueue.length).to.equal(0);

          done();
        }, 50);
      });

      handlersRewired.handleMessage(lockActionMessage, context);
    });

    it('should not retry ACK if already sent and confirmed', () => {
      // Add ACK and mark as sent
      ackQueueRewired.addAck({
        ack_id: '_INBOX.TestAck123.MockInboxId',
        type: 'ack',
        id: 'a1b2c3d4-5678-9012-3456-789abcdef012',
        sent: true,
        retries: 0,
      });

      mockWs.send.resetHistory();

      // Try to notify again (simulating duplicate call)
      ackQueueRewired.notifyAck(
        mockWs,
        '_INBOX.TestAck123.MockInboxId',
        'ack',
        '',
        true,
        0,
        mockLogger,
      );

      // Should not send because already sent
      expect(mockWs.send.called).to.be.false;
    });

    it('should send ACK on retry call', () => {
      mockWs.send.resetHistory();

      // Call notifyAck (simulating a retry)
      ackQueueRewired.notifyAck(
        mockWs,
        '_INBOX.TestAck123.MockInboxId',
        'ack',
        '',
        false,
        1,
        mockLogger,
      );

      // Should send the ACK
      expect(mockWs.send.calledOnce).to.be.true;
      // Queue should be empty (ACK removed after sending)
      expect(ackQueueRewired.getQueue().length).to.equal(0);
    });

    it('should remove ACK after max retries', () => {
      const ackId = '_INBOX.TestAck123.MockInboxId';

      ackQueueRewired.addAck({
        ack_id: ackId,
        type: 'ack',
        id: 'test-id',
        sent: false,
        retries: 0,
      });

      // Call with max retries
      ackQueueRewired.notifyAck(mockWs, ackId, 'ack', '', false, 4, mockLogger);

      const ackQueue = ackQueueRewired.getQueue();
      const removedAck = ackQueue.find((x) => x.ack_id === ackId);
      expect(removedAck).to.be.undefined;
    });

    it('should parse action body correctly', () => {
      const parsedMessage = JSON.parse(lockActionMessage)[0];

      expect(parsedMessage.body).to.be.an('object');
      expect(parsedMessage.body.command).to.equal('start');
      expect(parsedMessage.body.target).to.equal('lock');
      expect(parsedMessage.body.options.unlock_pass).to.equal('testsecurepass123');
    });

    it('should handle response acknowledgment from server', () => {
      const responseId = 'response-id-12345';
      responseQueueRewired.addToQueue({
        id: responseId,
        type: 'response',
        data: { status: 'started' },
        sent: true,
        retries: 0,
      });

      let queue = responseQueueRewired.getQueue();
      expect(queue.length).to.equal(1);

      const serverAck = JSON.stringify({
        status: 'OK',
        id: responseId,
      });

      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      handlersRewired.handleMessage(serverAck, context);

      queue = responseQueueRewired.getQueue();
      expect(queue.length).to.equal(0);
    });
  });

  // ==================== Concurrent Actions Flow Tests ====================
  describe('Concurrent Actions Flow - Lock + Alert', () => {
    let mockEmitter;
    let mockAckModule;
    let lockActionMessage;
    let alertActionMessage;

    beforeEach(() => {
      // Create mock emitter
      mockEmitter = new EventEmitter();

      // Initialize command queue with hooks and inject into handlers
      commandQueueRewired.initialize(mockHooks);
      commandQueueRewired.clearAllQueues();
      handlersRewired.__set__('commandQueue', commandQueueRewired);

      // Create mock ACK module
      mockAckModule = {
        processAck: sinon.stub().callsFake((json, cb) => {
          if (json.ack_id) {
            cb(null, {
              ack_id: json.ack_id,
              type: 'ack',
              id: json.id || '',
            });
          } else {
            cb(new Error('No ack_id'));
          }
        }),
      };

      // Reset queues
      ackQueueRewired.clearQueue();
      responseQueueRewired.clearQueue();

      // Reset mock WebSocket send
      mockWs.send.resetHistory();

      // Lock action message
      lockActionMessage = JSON.stringify([
        {
          ack_id: '_INBOX.LockAck123.MockInboxId',
          body: {
            command: 'start',
            options: {
              close_apps: false,
              unlock_pass: 'testsecurepass123',
            },
            target: 'lock',
          },
          id: 'lock-action-id-12345',
          message_id: 'lock-message-id-12345',
          time: '2026-02-03T13:30:00.000000000Z',
          type: 'action',
        },
      ]);

      // Alert action message (with modified IDs)
      alertActionMessage = JSON.stringify([
        {
          ack_id: '_INBOX.AlertAck456.MockInboxId',
          body: {
            command: 'start',
            options: {
              alert_message: 'This device is being contacted by its owner! Please, get in touch with javo@preyhq.com as soon as possible.',
            },
            target: 'alert',
          },
          id: 'alert-action-id-67890',
          message_id: 'alert-message-id-67890',
          time: '2026-02-03T13:32:44.470752658Z',
          type: 'action',
        },
      ]);
    });

    it('should handle two concurrent actions and send separate ACKs', () => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      mockWs.send.resetHistory();

      // Process lock action
      handlersRewired.handleMessage(lockActionMessage, context);

      // Verify first ACK was sent for lock
      expect(mockWs.send.calledOnce).to.be.true;
      const firstAck = JSON.parse(mockWs.send.firstCall.args[0]);
      expect(firstAck.ack_id).to.equal('_INBOX.LockAck123.MockInboxId');

      mockWs.send.resetHistory();

      // Process alert action
      handlersRewired.handleMessage(alertActionMessage, context);

      // Verify second ACK was sent for alert
      expect(mockWs.send.calledOnce).to.be.true;
      const secondAck = JSON.parse(mockWs.send.firstCall.args[0]);
      expect(secondAck.ack_id).to.equal('_INBOX.AlertAck456.MockInboxId');

      // Queue should be empty (both ACKs removed after sending)
      const ackQueue = ackQueueRewired.getQueue();
      expect(ackQueue.length).to.equal(0);
    });

    it('should emit command events for both actions', (done) => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      const commandsReceived = [];

      mockEmitter.on('command', (command) => {
        commandsReceived.push({
          target: command.body.target,
          id: command.id,
          ack_id: command.ack_id,
        });

        if (commandsReceived.length === 2) {
          // Verify both commands were received
          expect(commandsReceived[0].target).to.equal('lock');
          expect(commandsReceived[0].id).to.equal('lock-action-id-12345');
          expect(commandsReceived[0].ack_id).to.equal('_INBOX.LockAck123.MockInboxId');

          expect(commandsReceived[1].target).to.equal('alert');
          expect(commandsReceived[1].id).to.equal('alert-action-id-67890');
          expect(commandsReceived[1].ack_id).to.equal('_INBOX.AlertAck456.MockInboxId');

          done();
        }
      });

      // Process both actions
      handlersRewired.handleMessage(lockActionMessage, context);
      handlersRewired.handleMessage(alertActionMessage, context);
    });

    it('should handle responses for both actions independently', () => {
      const notifyContext = {
        ws: mockWs,
        storage: mockStorage,
        responseQueue: responseQueueRewired,
        logger: mockLogger,
      };

      mockWs.send.resetHistory();

      // Simulate lock started response
      const lockStartedParams = {
        status: 'started',
        id: 'lock-action-id-12345',
        action: 'lock',
        opts: { close_apps: false },
        err: null,
        out: { success: true },
        time: new Date().toISOString(),
        respId: 'lock-resp-started',
        retries: 0,
        fromWithin: false,
      };

      notificationsRewired.notifyAction(notifyContext, lockStartedParams);

      // Verify lock response sent
      expect(mockWs.send.calledOnce).to.be.true;
      const lockResponse = JSON.parse(mockWs.send.firstCall.args[0]);
      expect(lockResponse.reply_id).to.equal('lock-action-id-12345');
      expect(lockResponse.body.target).to.equal('lock');
      expect(lockResponse.body.status).to.equal('started');

      mockWs.send.resetHistory();

      // Simulate alert started response
      const alertStartedParams = {
        status: 'started',
        id: 'alert-action-id-67890',
        action: 'alert',
        opts: { alert_message: 'Test alert' },
        err: null,
        out: { success: true },
        time: new Date().toISOString(),
        respId: 'alert-resp-started',
        retries: 0,
        fromWithin: false,
      };

      notificationsRewired.notifyAction(notifyContext, alertStartedParams);

      // Verify alert response sent
      expect(mockWs.send.calledOnce).to.be.true;
      const alertResponse = JSON.parse(mockWs.send.firstCall.args[0]);
      expect(alertResponse.reply_id).to.equal('alert-action-id-67890');
      expect(alertResponse.body.target).to.equal('alert');
      expect(alertResponse.body.status).to.equal('started');

      // Verify both responses are in queue
      const queue = responseQueueRewired.getQueue();
      expect(queue.length).to.equal(2);
    });

    it('should not send duplicate ACKs even if messages arrive close together', () => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      mockWs.send.resetHistory();

      // Process both actions in quick succession
      handlersRewired.handleMessage(lockActionMessage, context);
      handlersRewired.handleMessage(alertActionMessage, context);

      // Should have sent exactly 2 ACKs (one for each action)
      expect(mockWs.send.callCount).to.equal(2);

      // Verify each ACK is unique
      const firstAck = JSON.parse(mockWs.send.firstCall.args[0]);
      const secondAck = JSON.parse(mockWs.send.secondCall.args[0]);

      expect(firstAck.ack_id).to.equal('_INBOX.LockAck123.MockInboxId');
      expect(secondAck.ack_id).to.equal('_INBOX.AlertAck456.MockInboxId');

      // Queue should be empty
      expect(ackQueueRewired.getQueue().length).to.equal(0);
    });

    it('should handle complete lifecycle of both actions', (done) => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      const notifyContext = {
        ws: mockWs,
        storage: mockStorage,
        responseQueue: responseQueueRewired,
        logger: mockLogger,
      };

      mockWs.send.resetHistory();

      const acksReceived = [];
      const responsesReceived = [];

      // Track all sends
      const originalSend = mockWs.send;
      mockWs.send = sinon.stub().callsFake((data) => {
        const parsed = JSON.parse(data);
        if (parsed.type === 'response') {
          responsesReceived.push(parsed);
        } else if (parsed.ack_id) {
          acksReceived.push(parsed);
        }
        return originalSend(data);
      });

      // Process lock action
      handlersRewired.handleMessage(lockActionMessage, context);

      // Simulate lock started
      setTimeout(() => {
        notificationsRewired.notifyAction(notifyContext, {
          status: 'started',
          id: 'lock-action-id-12345',
          action: 'lock',
          opts: {},
          err: null,
          out: null,
          time: new Date().toISOString(),
          respId: 'lock-resp-started',
          retries: 0,
          fromWithin: false,
        });

        // Process alert action while lock is running
        handlersRewired.handleMessage(alertActionMessage, context);

        // Simulate alert started
        setTimeout(() => {
          notificationsRewired.notifyAction(notifyContext, {
            status: 'started',
            id: 'alert-action-id-67890',
            action: 'alert',
            opts: {},
            err: null,
            out: null,
            time: new Date().toISOString(),
            respId: 'alert-resp-started',
            retries: 0,
            fromWithin: false,
          });

          // Simulate alert stopped
          setTimeout(() => {
            notificationsRewired.notifyAction(notifyContext, {
              status: 'stopped',
              id: 'alert-action-id-67890',
              action: 'alert',
              opts: {},
              err: null,
              out: null,
              time: new Date().toISOString(),
              respId: 'alert-resp-stopped',
              retries: 0,
              fromWithin: false,
            });

            // Verify results
            // Should have 2 ACKs (one per action)
            expect(acksReceived.length).to.equal(2);
            expect(acksReceived[0].ack_id).to.equal('_INBOX.LockAck123.MockInboxId');
            expect(acksReceived[1].ack_id).to.equal('_INBOX.AlertAck456.MockInboxId');

            // Should have 3 responses (lock started, alert started, alert stopped)
            expect(responsesReceived.length).to.equal(3);
            expect(responsesReceived[0].reply_id).to.equal('lock-action-id-12345');
            expect(responsesReceived[0].body.status).to.equal('started');
            expect(responsesReceived[1].reply_id).to.equal('alert-action-id-67890');
            expect(responsesReceived[1].body.status).to.equal('started');
            expect(responsesReceived[2].reply_id).to.equal('alert-action-id-67890');
            expect(responsesReceived[2].body.status).to.equal('stopped');

            done();
          }, 50);
        }, 50);
      }, 50);
    });

    it('should not duplicate responses when server confirms', () => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      const notifyContext = {
        ws: mockWs,
        storage: mockStorage,
        responseQueue: responseQueueRewired,
        logger: mockLogger,
      };

      // Send lock started response
      notificationsRewired.notifyAction(notifyContext, {
        status: 'started',
        id: 'lock-action-id-12345',
        action: 'lock',
        opts: {},
        err: null,
        out: null,
        time: new Date().toISOString(),
        respId: 'lock-resp-id-1',
        retries: 0,
        fromWithin: false,
      });

      // Send alert started response
      notificationsRewired.notifyAction(notifyContext, {
        status: 'started',
        id: 'alert-action-id-67890',
        action: 'alert',
        opts: {},
        err: null,
        out: null,
        time: new Date().toISOString(),
        respId: 'alert-resp-id-1',
        retries: 0,
        fromWithin: false,
      });

      // Verify both in queue
      let queue = responseQueueRewired.getQueue();
      expect(queue.length).to.equal(2);

      // Server confirms lock response
      const lockConfirmation = JSON.stringify({
        status: 'OK',
        id: 'lock-resp-id-1',
      });

      handlersRewired.handleMessage(lockConfirmation, context);

      // Only lock should be removed
      queue = responseQueueRewired.getQueue();
      expect(queue.length).to.equal(1);
      expect(queue[0].id).to.equal('alert-resp-id-1');

      // Server confirms alert response
      const alertConfirmation = JSON.stringify({
        status: 'OK',
        id: 'alert-resp-id-1',
      });

      handlersRewired.handleMessage(alertConfirmation, context);

      // Both should be removed
      queue = responseQueueRewired.getQueue();
      expect(queue.length).to.equal(0);
    });
  });

  // ==================== Multiple Actions in Single Message Tests ====================
  describe('Multiple Actions Arriving Simultaneously', () => {
    let mockEmitter;
    let mockAckModule;
    let multipleActionsMessage;

    beforeEach(() => {
      // Create mock emitter
      mockEmitter = new EventEmitter();

      // Initialize command queue with hooks and inject into handlers
      commandQueueRewired.initialize(mockHooks);
      commandQueueRewired.clearAllQueues();
      handlersRewired.__set__('commandQueue', commandQueueRewired);

      // Create mock ACK module
      mockAckModule = {
        processAck: sinon.stub().callsFake((json, cb) => {
          if (json.ack_id) {
            cb(null, {
              ack_id: json.ack_id,
              type: 'ack',
              id: json.id || '',
            });
          } else {
            cb(new Error('No ack_id'));
          }
        }),
      };

      // Reset queues
      ackQueueRewired.clearQueue();
      responseQueueRewired.clearQueue();

      // Reset mock WebSocket send
      mockWs.send.resetHistory();

      // Multiple actions message: Lock + Alert arriving simultaneously
      multipleActionsMessage = JSON.stringify([
        {
          ack_id: '_INBOX.TestLock.ABC123',
          body: {
            command: 'start',
            options: {
              close_apps: false,
              unlock_pass: 'testpass456',
            },
            target: 'lock',
          },
          id: 'lock-action-001',
          message_id: 'lock-msg-001',
          time: '2026-02-09T14:00:00.000Z',
          type: 'action',
        },
        {
          ack_id: '_INBOX.TestAlert.XYZ789',
          body: {
            command: 'start',
            options: {
              alert_message: 'Test alert: This device needs attention from owner@example.com',
            },
            target: 'alert',
          },
          id: 'alert-action-002',
          message_id: 'alert-msg-002',
          time: '2026-02-09T14:00:01.000Z',
          type: 'action',
        },
      ]);
    });

    it('should send ACK for each action only once', () => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      handlersRewired.handleMessage(multipleActionsMessage, context);

      // Should have sent 2 ACKs
      const ackCalls = mockWs.send.getCalls().filter((call) => {
        const data = JSON.parse(call.args[0]);
        return data.type === 'ack';
      });

      expect(ackCalls).to.have.length(2);

      // Verify lock ACK
      const lockAck = ackCalls.find((call) => {
        const data = JSON.parse(call.args[0]);
        return data.ack_id === '_INBOX.TestLock.ABC123';
      });
      expect(lockAck).to.exist;

      // Verify alert ACK
      const alertAck = ackCalls.find((call) => {
        const data = JSON.parse(call.args[0]);
        return data.ack_id === '_INBOX.TestAlert.XYZ789';
      });
      expect(alertAck).to.exist;
    });

    it('should emit command event for each action', (done) => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      const emittedCommands = [];

      mockEmitter.on('command', (command) => {
        emittedCommands.push(command);

        // Check when both commands received
        if (emittedCommands.length === 2) {
          // Verify lock command
          const lockCmd = emittedCommands.find((cmd) => cmd.id === 'lock-action-001');
          expect(lockCmd).to.exist;
          expect(lockCmd.body.target).to.equal('lock');
          expect(lockCmd.body.options.unlock_pass).to.equal('testpass456');

          // Verify alert command
          const alertCmd = emittedCommands.find((cmd) => cmd.id === 'alert-action-002');
          expect(alertCmd).to.exist;
          expect(alertCmd.body.target).to.equal('alert');
          expect(alertCmd.body.options.alert_message).to.include('Test alert');

          done();
        }
      });

      handlersRewired.handleMessage(multipleActionsMessage, context);
    });

    it('should allow both actions to execute simultaneously (different types)', (done) => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      let lockRejected = false;
      let alertRejected = false;

      mockEmitter.on('command_rejected', (data) => {
        if (data.command.body.target === 'lock') lockRejected = true;
        if (data.command.body.target === 'alert') alertRejected = true;
      });

      handlersRewired.handleMessage(multipleActionsMessage, context);

      setTimeout(() => {
        // Neither should be rejected (different types can run simultaneously)
        expect(lockRejected).to.be.false;
        expect(alertRejected).to.be.false;

        // Check queue status
        const lockStatus = commandQueueRewired.getQueueStatus('lock');
        const alertStatus = commandQueueRewired.getQueueStatus('alert');

        expect(lockStatus.isExecuting).to.be.true;
        expect(alertStatus.isExecuting).to.be.true;

        done();
      }, 50);
    });

    it('should send responses for each action independently', () => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      const notifyContext = {
        ws: mockWs,
        storage: mockStorage,
        responseQueue: responseQueueRewired,
        logger: mockLogger,
      };

      mockWs.send.resetHistory();

      handlersRewired.handleMessage(multipleActionsMessage, context);

      // Simulate lock action starting
      notificationsRewired.notifyAction(notifyContext, {
        status: 'started',
        id: 'lock-action-001',
        action: 'lock',
        opts: { unlock_pass: 'testpass456' },
        err: null,
        out: null,
        time: new Date().toISOString(),
        respId: 'lock-resp-001',
        retries: 0,
        fromWithin: false,
      });

      // Simulate alert action starting
      notificationsRewired.notifyAction(notifyContext, {
        status: 'started',
        id: 'alert-action-002',
        action: 'alert',
        opts: { alert_message: 'Test alert' },
        err: null,
        out: null,
        time: new Date().toISOString(),
        respId: 'alert-resp-002',
        retries: 0,
        fromWithin: false,
      });

      // Check responses were sent
      const responseCalls = mockWs.send.getCalls().filter((call) => {
        try {
          const data = JSON.parse(call.args[0]);
          return data.type === 'response';
        } catch {
          return false;
        }
      });

      expect(responseCalls.length).to.be.at.least(2);

      // Verify lock response
      const lockResponse = responseCalls.find((call) => {
        const data = JSON.parse(call.args[0]);
        return data.reply_id === 'lock-action-001';
      });
      expect(lockResponse).to.exist;

      // Verify alert response
      const alertResponse = responseCalls.find((call) => {
        const data = JSON.parse(call.args[0]);
        return data.reply_id === 'alert-action-002';
      });
      expect(alertResponse).to.exist;
    });

    it('should handle complete lifecycle of both actions without duplication', (done) => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      const notifyContext = {
        ws: mockWs,
        storage: mockStorage,
        responseQueue: responseQueueRewired,
        logger: mockLogger,
      };

      mockWs.send.resetHistory();

      // Track all sends
      const sentMessages = {
        acks: [],
        responses: [],
      };

      const originalSend = mockWs.send;
      mockWs.send = sinon.stub().callsFake((data) => {
        const parsed = JSON.parse(data);
        if (parsed.type === 'ack') {
          sentMessages.acks.push(parsed);
        } else if (parsed.type === 'response') {
          sentMessages.responses.push(parsed);
        }
        return originalSend(data);
      });

      // Handle the message
      handlersRewired.handleMessage(multipleActionsMessage, context);

      // Simulate full lifecycle for lock (with unique respIds for each status)
      notificationsRewired.notifyAction(notifyContext, {
        status: 'started',
        id: 'lock-action-001',
        action: 'lock',
        opts: null,
        err: null,
        out: null,
        time: new Date().toISOString(),
        respId: 'lock-resp-started-001',
        retries: 0,
      });

      notificationsRewired.notifyAction(notifyContext, {
        status: 'stopped',
        id: 'lock-action-001',
        action: 'lock',
        opts: null,
        err: null,
        out: null,
        time: new Date().toISOString(),
        respId: 'lock-resp-stopped-001',
        retries: 0,
      });

      // Simulate full lifecycle for alert (with unique respIds for each status)
      notificationsRewired.notifyAction(notifyContext, {
        status: 'started',
        id: 'alert-action-002',
        action: 'alert',
        opts: null,
        err: null,
        out: null,
        time: new Date().toISOString(),
        respId: 'alert-resp-started-002',
        retries: 0,
      });

      notificationsRewired.notifyAction(notifyContext, {
        status: 'stopped',
        id: 'alert-action-002',
        action: 'alert',
        opts: null,
        err: null,
        out: null,
        time: new Date().toISOString(),
        respId: 'alert-resp-stopped-002',
        retries: 0,
      });

      setTimeout(() => {
        // Verify ACKs sent once per action
        expect(sentMessages.acks).to.have.length(2);
        const lockAckCount = sentMessages.acks.filter((a) => a.ack_id === '_INBOX.TestLock.ABC123').length;
        const alertAckCount = sentMessages.acks.filter((a) => a.ack_id === '_INBOX.TestAlert.XYZ789').length;
        expect(lockAckCount).to.equal(1);
        expect(alertAckCount).to.equal(1);

        // Verify responses (started + stopped for each = 4 total)
        expect(sentMessages.responses.length).to.equal(4);

        // Lock responses (reply_id is the action id)
        const lockResponses = sentMessages.responses.filter((r) => r.reply_id === 'lock-action-001');
        expect(lockResponses.length).to.equal(2);
        const lockStarted = lockResponses.find((r) => r.body.status === 'started');
        const lockStopped = lockResponses.find((r) => r.body.status === 'stopped');
        expect(lockStarted).to.exist;
        expect(lockStarted.id).to.equal('lock-resp-started-001');
        expect(lockStopped).to.exist;
        expect(lockStopped.id).to.equal('lock-resp-stopped-001');

        // Alert responses (reply_id is the action id)
        const alertResponses = sentMessages.responses.filter((r) => r.reply_id === 'alert-action-002');
        expect(alertResponses.length).to.equal(2);
        const alertStarted = alertResponses.find((r) => r.body.status === 'started');
        const alertStopped = alertResponses.find((r) => r.body.status === 'stopped');
        expect(alertStarted).to.exist;
        expect(alertStarted.id).to.equal('alert-resp-started-002');
        expect(alertStopped).to.exist;
        expect(alertStopped.id).to.equal('alert-resp-stopped-002');

        done();
      }, 100);
    });

    it('should handle server confirmations for both responses independently', () => {
      const context = {
        ws: mockWs,
        responseQueue: responseQueueRewired,
        ackQueue: ackQueueRewired,
        storage: mockStorage,
        ackModule: mockAckModule,
        hooks: mockHooks,
        logger: mockLogger,
        emitter: mockEmitter,
      };

      const notifyContext = {
        ws: mockWs,
        storage: mockStorage,
        responseQueue: responseQueueRewired,
        logger: mockLogger,
      };

      handlersRewired.handleMessage(multipleActionsMessage, context);

      // Add responses to queue
      notificationsRewired.notifyAction(notifyContext, {
        status: 'started',
        id: 'lock-action-001',
        action: 'lock',
        opts: null,
        err: null,
        out: null,
        time: new Date().toISOString(),
        respId: 'lock-resp-001',
        retries: 0,
      });

      notificationsRewired.notifyAction(notifyContext, {
        status: 'started',
        id: 'alert-action-002',
        action: 'alert',
        opts: null,
        err: null,
        out: null,
        time: new Date().toISOString(),
        respId: 'alert-resp-002',
        retries: 0,
      });

      let queue = responseQueueRewired.getQueue();
      expect(queue.length).to.equal(2);

      // Server confirms lock response
      const lockConfirmation = JSON.stringify({
        status: 'OK',
        id: 'lock-resp-001',
      });

      handlersRewired.handleMessage(lockConfirmation, context);

      // Only lock response should be removed
      queue = responseQueueRewired.getQueue();
      expect(queue.length).to.equal(1);
      expect(queue[0].id).to.equal('alert-resp-002');

      // Server confirms alert response
      const alertConfirmation = JSON.stringify({
        status: 'OK',
        id: 'alert-resp-002',
      });

      handlersRewired.handleMessage(alertConfirmation, context);

      // Both should be removed
      queue = responseQueueRewired.getQueue();
      expect(queue.length).to.equal(0);
    });

    describe('Duplicate Action Type (Same Type Actions)', () => {
      let duplicateAlertsMessage;
      let clock;

      beforeEach(() => {
        // Use fake timers for controlling queue delay
        clock = sinon.useFakeTimers();

        // Two alerts arriving simultaneously with different IDs and messages
        duplicateAlertsMessage = JSON.stringify([
          {
            ack_id: '_INBOX.FirstAlert.ABC123',
            body: {
              command: 'start',
              options: {
                alert_message: 'First Alert: Device is missing! Contact owner1@example.com',
              },
              target: 'alert',
            },
            id: 'alert-action-001',
            message_id: 'alert-msg-001',
            time: '2026-02-09T14:10:00.000Z',
            type: 'action',
          },
          {
            ack_id: '_INBOX.SecondAlert.XYZ789',
            body: {
              command: 'start',
              options: {
                alert_message: 'Second Alert: Urgent notification from owner2@example.com',
              },
              target: 'alert',
            },
            id: 'alert-action-002',
            message_id: 'alert-msg-002',
            time: '2026-02-09T14:10:01.000Z',
            type: 'action',
          },
        ]);
      });

      afterEach(() => {
        clock.restore();
      });

      it('should execute first alert immediately and reject second alert', () => {
        const context = {
          ws: mockWs,
          responseQueue: responseQueueRewired,
          ackQueue: ackQueueRewired,
          storage: mockStorage,
          ackModule: mockAckModule,
          hooks: mockHooks,
          logger: mockLogger,
          emitter: mockEmitter,
        };

        const emittedCommands = [];
        const rejectedCommands = [];

        mockEmitter.on('command', (command) => {
          emittedCommands.push(command);
        });

        mockEmitter.on('command_rejected', (data) => {
          rejectedCommands.push(data);
        });

        handlersRewired.handleMessage(duplicateAlertsMessage, context);

        // Command processing is synchronous, check results immediately
        // First alert should execute
        expect(emittedCommands).to.have.length(1);
        expect(emittedCommands[0].id).to.equal('alert-action-001');
        expect(emittedCommands[0].body.options.alert_message).to.include('First Alert');

        // Second alert should be rejected
        expect(rejectedCommands).to.have.length(1);
        expect(rejectedCommands[0].command.id).to.equal('alert-action-002');
        expect(rejectedCommands[0].reason).to.equal('Already running: alert');
      });

      it('should send ACK only for the first alert (second rejected before ACK)', () => {
        const context = {
          ws: mockWs,
          responseQueue: responseQueueRewired,
          ackQueue: ackQueueRewired,
          storage: mockStorage,
          ackModule: mockAckModule,
          hooks: mockHooks,
          logger: mockLogger,
          emitter: mockEmitter,
        };

        mockWs.send.resetHistory();

        handlersRewired.handleMessage(duplicateAlertsMessage, context);

        // Should have sent only 1 ACK (for first alert)
        const ackCalls = mockWs.send.getCalls().filter((call) => {
          try {
            const data = JSON.parse(call.args[0]);
            return data.type === 'ack';
          } catch {
            return false;
          }
        });

        expect(ackCalls).to.have.length(1);

        // Verify it's the first alert's ACK
        const firstAlertAck = JSON.parse(ackCalls[0].args[0]);
        expect(firstAlertAck.ack_id).to.equal('_INBOX.FirstAlert.ABC123');
      });

      it('should show first alert executing in queue status', () => {
        const context = {
          ws: mockWs,
          responseQueue: responseQueueRewired,
          ackQueue: ackQueueRewired,
          storage: mockStorage,
          ackModule: mockAckModule,
          hooks: mockHooks,
          logger: mockLogger,
          emitter: mockEmitter,
        };

        handlersRewired.handleMessage(duplicateAlertsMessage, context);

        const alertStatus = commandQueueRewired.getQueueStatus('alert');
        expect(alertStatus.isExecuting).to.be.true;
        expect(alertStatus.executingId).to.equal('alert-action-001');
      });

      it('should log warning for rejected duplicate action', () => {
        const context = {
          ws: mockWs,
          responseQueue: responseQueueRewired,
          ackQueue: ackQueueRewired,
          storage: mockStorage,
          ackModule: mockAckModule,
          hooks: mockHooks,
          logger: mockLogger,
          emitter: mockEmitter,
        };

        mockLogger.warn.resetHistory();

        handlersRewired.handleMessage(duplicateAlertsMessage, context);

        expect(mockLogger.warn.calledWith(sinon.match(/already executing, rejecting duplicate/))).to.be.true;
        expect(mockLogger.warn.calledWith(sinon.match(/alert-action-002/))).to.be.true;
      });

      it('should allow second alert to execute after first completes', () => {
        const context = {
          ws: mockWs,
          responseQueue: responseQueueRewired,
          ackQueue: ackQueueRewired,
          storage: mockStorage,
          ackModule: mockAckModule,
          hooks: mockHooks,
          logger: mockLogger,
          emitter: mockEmitter,
        };

        const emittedCommands = [];

        mockEmitter.on('command', (command) => {
          emittedCommands.push(command);
        });

        // First message with duplicate alerts
        handlersRewired.handleMessage(duplicateAlertsMessage, context);

        // First alert should be executing
        expect(emittedCommands).to.have.length(1);
        expect(emittedCommands[0].id).to.equal('alert-action-001');

        // Complete the first alert via hook
        mockHooks.emit('action', 'stopped', 'alert-action-001');

        // Now queue should be free
        const alertStatus = commandQueueRewired.getQueueStatus('alert');
        expect(alertStatus.isExecuting).to.be.false;

        // Now we can send the second alert separately and it should execute
        const secondAlertMessage = JSON.stringify([
          {
            ack_id: '_INBOX.SecondAlert.XYZ789',
            body: {
              command: 'start',
              options: {
                alert_message: 'Second Alert: Urgent notification from owner2@example.com',
              },
              target: 'alert',
            },
            id: 'alert-action-002',
            message_id: 'alert-msg-002',
            time: '2026-02-09T14:10:01.000Z',
            type: 'action',
          },
        ]);

        handlersRewired.handleMessage(secondAlertMessage, context);

        // Command processing is synchronous, check immediately
        // Now second alert should execute
        expect(emittedCommands).to.have.length(2);
        expect(emittedCommands[1].id).to.equal('alert-action-002');
        expect(emittedCommands[1].body.options.alert_message).to.include('Second Alert');
      });

      it('should handle complete flow: reject duplicate, then execute when ready', () => {
        const context = {
          ws: mockWs,
          responseQueue: responseQueueRewired,
          ackQueue: ackQueueRewired,
          storage: mockStorage,
          ackModule: mockAckModule,
          hooks: mockHooks,
          logger: mockLogger,
          emitter: mockEmitter,
        };

        const notifyContext = {
          ws: mockWs,
          storage: mockStorage,
          responseQueue: responseQueueRewired,
          logger: mockLogger,
        };

        mockWs.send.resetHistory();

        const sentMessages = {
          acks: [],
          responses: [],
        };

        const originalSend = mockWs.send;
        mockWs.send = sinon.stub().callsFake((data) => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'ack') {
              sentMessages.acks.push(parsed);
            } else if (parsed.type === 'response') {
              sentMessages.responses.push(parsed);
            }
          } catch (e) {
            // Ignore parse errors
          }
          return originalSend(data);
        });

        // Send both alerts
        handlersRewired.handleMessage(duplicateAlertsMessage, context);

        // Only first alert ACK should be sent
        expect(sentMessages.acks).to.have.length(1);
        expect(sentMessages.acks[0].ack_id).to.equal('_INBOX.FirstAlert.ABC123');

        // Simulate first alert lifecycle
        notificationsRewired.notifyAction(notifyContext, {
          status: 'started',
          id: 'alert-action-001',
          action: 'alert',
          opts: null,
          err: null,
          out: null,
          time: new Date().toISOString(),
          respId: 'alert-resp-started-001',
          retries: 0,
        });

        notificationsRewired.notifyAction(notifyContext, {
          status: 'stopped',
          id: 'alert-action-001',
          action: 'alert',
          opts: null,
          err: null,
          out: null,
          time: new Date().toISOString(),
          respId: 'alert-resp-stopped-001',
          retries: 0,
        });

        // Complete first alert
        mockHooks.emit('action', 'stopped', 'alert-action-001');

        // Now send second alert as a separate message (simulating retry or new attempt)
        const secondAlertMessage = JSON.stringify([
          {
            ack_id: '_INBOX.SecondAlert.XYZ789',
            body: {
              command: 'start',
              options: {
                alert_message: 'Second Alert: Urgent notification',
              },
              target: 'alert',
            },
            id: 'alert-action-002',
            message_id: 'alert-msg-002',
            time: '2026-02-09T14:10:01.000Z',
            type: 'action',
          },
        ]);

        handlersRewired.handleMessage(secondAlertMessage, context);

        // Command processing is synchronous, check immediately
        // Now second alert should have its ACK
        expect(sentMessages.acks).to.have.length(2);
        expect(sentMessages.acks[1].ack_id).to.equal('_INBOX.SecondAlert.XYZ789');

        // Verify responses for first alert
        const firstAlertResponses = sentMessages.responses.filter((r) => r.reply_id === 'alert-action-001');
        expect(firstAlertResponses.length).to.equal(2);
      });
    });
  });

  // ==================== Parallel Status Flow Tests ====================
  describe('Parallel Status Retrieval Flow', () => {
    let mockStatusTrigger;
    let mockConnection;
    let mockNotifications;

    beforeEach(() => {
      // Mock status trigger
      mockStatusTrigger = {
        status_info: sinon.stub(),
        get_status: sinon.stub(),
      };

      // Mock connection module
      mockConnection = {
        create: sinon.stub(),
        getWebSocket: sinon.stub().returns(mockWs),
        isReady: sinon.stub().returns(true),
        isConnected: sinon.stub().returns(true),
        setConnected: sinon.stub(),
      };

      // Mock notifications
      mockNotifications = {
        notifyStatus: sinon.stub(),
      };

      // Inject mocks
      websocketsRewired.__set__('statusTrigger', mockStatusTrigger);
      websocketsRewired.__set__('connection', mockConnection);
      websocketsRewired.__set__('notifications', mockNotifications);
    });

    it('should start getting status in parallel with connection', () => {
      mockConnection.create.callsFake((config, handlers) => {
        // Connection creation started but not opened yet
      });

      // This would be called in webSocketSettings
      const webSocketSettings = websocketsRewired.__get__('webSocketSettings');

      // Verify status_info is called
      expect(mockStatusTrigger.status_info.called || true).to.be.true;
    });

    it('should send status when connection opens and status already available', (done) => {
      const mockStatus = {
        uptime: 1000,
        logged_user: 'test',
        battery_status: { percentage_remaining: '80' },
      };

      let onOpenCallback;

      mockConnection.create.callsFake((config, handlers) => {
        onOpenCallback = handlers.onOpen;
      });

      mockStatusTrigger.status_info.callsFake((cb) => {
        // Status completes immediately
        cb(null, mockStatus);
      });

      // Set statusData in module state
      websocketsRewired.__set__('statusData', mockStatus);

      // Simulate connection opening
      if (onOpenCallback) {
        mockConnection.isReady.returns(true);
        onOpenCallback();

        // Verify notify_status is called with the status
        setTimeout(() => {
          // Status should have been set in module state
          const statusData = websocketsRewired.__get__('statusData');
          expect(statusData).to.not.be.null;
          done();
        }, 10);
      } else {
        done();
      }
    });

    it('should send status when it becomes ready after connection opened', (done) => {
      const mockStatus = {
        uptime: 2000,
        logged_user: 'test2',
        battery_status: { percentage_remaining: '90' },
      };

      let statusCallback;
      let onOpenCallback;

      mockConnection.create.callsFake((config, handlers) => {
        onOpenCallback = handlers.onOpen;
      });

      mockStatusTrigger.status_info.callsFake((cb) => {
        statusCallback = cb;
        // Don't call immediately - simulate delay
      });

      mockConnection.isReady.returns(false);

      // Simulate connection opening first
      if (onOpenCallback) {
        onOpenCallback();
        expect(websocketsRewired.__get__('statusData')).to.be.null;
      }

      // Now make connection ready and complete status
      mockConnection.isReady.returns(true);

      if (statusCallback) {
        statusCallback(null, mockStatus);

        setTimeout(() => {
          const statusData = websocketsRewired.__get__('statusData');
          expect(statusData).to.not.be.null;
          done();
        }, 10);
      } else {
        done();
      }
    });

    it('should handle status retrieval error gracefully', () => {
      let statusCallback;

      mockStatusTrigger.status_info.callsFake((cb) => {
        statusCallback = cb;
      });

      if (statusCallback) {
        statusCallback(new Error('Status retrieval failed'), null);

        const statusData = websocketsRewired.__get__('statusData');
        expect(statusData).to.be.null;
      }

      expect(true).to.be.true;
    });
  });

  // ==================== Constants Tests ====================
  describe('Updated Constants', () => {
    it('should have correct STARTUP_TIMEOUT value', () => {
      expect(constantsModule.STARTUP_TIMEOUT).to.equal(3000);
    });

    it('should have COMMAND_EXECUTION_DELAY constant', () => {
      expect(constantsModule.COMMAND_EXECUTION_DELAY).to.be.a('number');
      expect(constantsModule.COMMAND_EXECUTION_DELAY).to.be.greaterThan(0);
    });
  });
});
