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
      expect(constantsModule.STARTUP_TIMEOUT).to.equal(5000);
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

      it('should add ack to queue if not already present', () => {
        ackQueueRewired.sendAckToServer(mockWs, { ack_id: 'new-ack', type: 'ack', retries: 0 }, mockLogger);
        expect(ackQueueRewired.getQueue()).to.have.length(1);
      });

      it('should not duplicate ack in queue', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack', retries: 0 });
        ackQueueRewired.sendAckToServer(mockWs, { ack_id: 'ack-1', type: 'ack', retries: 0 }, mockLogger);
        expect(ackQueueRewired.getQueue()).to.have.length(1);
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
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack', id: 'cmd-1', sent: true, retries: 0 });
        ackQueueRewired.notifyAck(mockWs, 'ack-1', 'ack', 'cmd-1', true, 0, mockLogger);

        expect(mockWs.send.calledOnce).to.be.true;
      });

      it('should not send when ws is not ready', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack', id: 'cmd-1', sent: true, retries: 0 });
        ackQueueRewired.notifyAck(null, 'ack-1', 'ack', 'cmd-1', true, 0, mockLogger);

        expect(mockWs.send.called).to.be.false;
      });

      it('should add new ack if not in queue', () => {
        ackQueueRewired.notifyAck(mockWs, 'new-ack', 'ack', 'cmd-1', true, 0, mockLogger);
        expect(ackQueueRewired.getQueue()).to.have.length(1);
      });

      it('should increment retries for existing ack', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack', id: 'cmd-1', sent: true, retries: 1 });
        ackQueueRewired.notifyAck(mockWs, 'ack-1', 'ack', 'cmd-1', true, 1, mockLogger);

        const ack = ackQueueRewired.findAck('ack-1');
        expect(ack.retries).to.equal(2);
      });
    });

    describe('retryAckResponses', () => {
      it('should do nothing when queue is empty', () => {
        ackQueueRewired.retryAckResponses(mockWs, mockLogger);
        expect(mockWs.send.called).to.be.false;
      });

      it('should retry acks in queue', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack', id: 'cmd-1', sent: true, retries: 0 });
        ackQueueRewired.retryAckResponses(mockWs, mockLogger);

        expect(mockWs.send.called).to.be.true;
      });

      it('should remove acks that exceed max retries', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack', id: 'cmd-1', sent: true, retries: 5 });
        ackQueueRewired.retryAckResponses(mockWs, mockLogger);

        expect(ackQueueRewired.getQueue()).to.have.length(0);
      });

      it('should not send when ws is not ready', () => {
        ackQueueRewired.addAck({ ack_id: 'ack-1', type: 'ack', id: 'cmd-1', sent: true, retries: 0 });
        ackQueueRewired.retryAckResponses(null, mockLogger);

        expect(mockWs.send.called).to.be.false;
      });
    });

    describe('processAcks', () => {
      it('should process array of acks', () => {
        const mockAckModule = {
          processAck: sinon.stub().callsFake((item, cb) => {
            cb(null, { ack_id: item.ack_id, type: 'ack', id: item.id });
          }),
        };

        ackQueueRewired.processAcks(
          [{ ack_id: 'ack-1', id: 'cmd-1' }],
          mockAckModule,
          mockLogger,
        );

        expect(ackQueueRewired.getQueue()).to.have.length(1);
      });

      it('should log error when processAck fails', () => {
        const mockAckModule = {
          processAck: sinon.stub().callsFake((item, cb) => {
            cb(new Error('Processing failed'));
          }),
        };

        ackQueueRewired.processAcks([{ ack_id: 'ack-1' }], mockAckModule, mockLogger);
        expect(mockLogger.error.called).to.be.true;
      });

      it('should handle empty array', () => {
        const mockAckModule = {
          processAck: sinon.stub(),
        };

        ackQueueRewired.processAcks([], mockAckModule, mockLogger);
        expect(mockAckModule.processAck.called).to.be.false;
      });

      it('should process multiple acks', () => {
        const mockAckModule = {
          processAck: sinon.stub().callsFake((item, cb) => {
            cb(null, { ack_id: item.ack_id, type: 'ack', id: item.id });
          }),
        };

        ackQueueRewired.processAcks(
          [
            { ack_id: 'ack-1', id: 'cmd-1' },
            { ack_id: 'ack-2', id: 'cmd-2' },
            { ack_id: 'ack-3', id: 'cmd-3' },
          ],
          mockAckModule,
          mockLogger,
        );

        expect(ackQueueRewired.getQueue()).to.have.length(3);
      });
    });
  });

  // ==================== Handlers Tests ====================
  describe('Handlers Module', () => {
    describe('groupByStructure', () => {
      it('should group objects by structure signature', () => {
        const objects = [
          { action: 'lock', id: '1' },
          { action: 'alarm', id: '2' },
          { action: 'wipe', target: 'disk', id: '3' },
        ];

        const grouped = handlersRewired.groupByStructure(objects);
        const keys = Object.keys(grouped);
        expect(keys).to.have.length(2);
      });

      it('should handle empty array', () => {
        const grouped = handlersRewired.groupByStructure([]);
        expect(grouped).to.deep.equal({});
      });

      it('should handle nested objects', () => {
        const objects = [
          { action: 'lock', options: { force: true } },
          { action: 'alarm', options: { force: false } },
        ];

        const grouped = handlersRewired.groupByStructure(objects);
        const keys = Object.keys(grouped);
        expect(keys).to.have.length(1);
      });
    });

    describe('processCommands', () => {
      it('should emit commands via emitter', (done) => {
        const emitterMock = new EventEmitter();
        emitterMock.on('command', (cmd) => {
          expect(cmd.action).to.equal('lock');
          done();
        });

        handlersRewired.processCommands(
          [{ action: 'lock', id: '1' }],
          emitterMock,
          mockHooks,
          mockLogger,
        );
      });
    });

    describe('handleMessage', () => {
      it('should handle invalid JSON', () => {
        const context = {
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
});
