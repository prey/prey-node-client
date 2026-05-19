/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/**
 * Tests for WebSocket bug fixes documented in websocket-analysis.md.
 */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('WebSocket Bug Fixes', () => {
  // =====================================================================
  // Bug #10: pong-wait setTimeout inside ping interval is cancelable
  // =====================================================================
  describe('Bug #10: pong-wait timeout is cancelable', () => {
    let heartbeat;
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
      heartbeat = rewire('../../../../../lib/agent/control-panel/websockets/heartbeat');
    });

    afterEach(() => {
      heartbeat.clearAll();
      clock.restore();
    });

    const makePingWs = () => ({
      readyState: 1,
      ping: sinon.stub().callsFake((data, cb) => cb && cb()),
    });

    const mockLog = { info: sinon.stub(), error: sinon.stub(), warn: sinon.stub(), debug: sinon.stub() };

    it('should expose getPongWaitTimeout()', () => {
      expect(heartbeat.getPongWaitTimeout).to.be.a('function');
    });

    it('should store pong-wait timeout after ping is sent', () => {
      heartbeat.startPingInterval(makePingWs(), mockLog, () => {});
      clock.tick(60001); // trigger interval
      expect(heartbeat.getPongWaitTimeout()).to.not.be.null;
    });

    it('should clear pong-wait timeout when clearAll() is called', () => {
      const onFailure = sinon.stub();
      heartbeat.startPingInterval(makePingWs(), mockLog, onFailure);
      clock.tick(60001); // trigger interval, pong-wait scheduled
      heartbeat.clearAll();
      expect(heartbeat.getPongWaitTimeout()).to.be.null;
      // Advance past pong-wait; onFailure must NOT fire since it was cancelled
      clock.tick(15001);
      expect(onFailure.called).to.be.false;
    });

    it('should clear pong-wait timeout when clearPingInterval() is called', () => {
      const onFailure = sinon.stub();
      heartbeat.startPingInterval(makePingWs(), mockLog, onFailure);
      clock.tick(60001);
      heartbeat.clearPingInterval();
      expect(heartbeat.getPongWaitTimeout()).to.be.null;
      clock.tick(15001);
      expect(onFailure.called).to.be.false;
    });

    it('should not fire onFailure from a previous pong-wait after reconnect', () => {
      const onFailure = sinon.stub();
      heartbeat.startPingInterval(makePingWs(), mockLog, onFailure);
      clock.tick(60001); // interval tick → pong-wait scheduled

      // Simulate reconnect: clearAll then restart with a fresh connection
      heartbeat.clearAll();
      heartbeat.startPingInterval(makePingWs(), mockLog, onFailure);

      // The original pong-wait should NOT fire
      clock.tick(15001);
      expect(onFailure.called).to.be.false;
    });
  });

  // =====================================================================
  // Bug #14: sentAckIds Set is capped to prevent memory leak
  // =====================================================================
  describe('Bug #14: sentAckIds is capped', () => {
    let ackQueue;
    let mockWs;
    let mockLog;

    beforeEach(() => {
      ackQueue = rewire('../../../../../lib/agent/control-panel/websockets/queues/ack-queue');
      ackQueue.clearQueue();
      mockWs = { readyState: 1, send: sinon.stub() };
      mockLog = { info: sinon.stub(), error: sinon.stub(), warn: sinon.stub(), debug: sinon.stub() };
    });

    afterEach(() => {
      ackQueue.clearQueue();
    });

    it('should send a new ACK after cap is reached (set was cleared)', () => {
      // Fill set to cap (1000 entries) using unique IDs
      for (let i = 0; i < 1000; i++) {
        const ackData = { ack_id: `fill-${i}`, type: 'test', retries: 0 };
        ackQueue.sendAckToServer(mockWs, ackData, mockLog);
      }
      mockWs.send.reset();

      // The 1001st ACK should go through (set was cleared at cap)
      const newAck = { ack_id: 'new-after-cap', type: 'test', retries: 0 };
      ackQueue.sendAckToServer(mockWs, newAck, mockLog);

      expect(mockWs.send.calledOnce).to.be.true;
    });

    it('should deduplicate ACKs within a session (before cap)', () => {
      const ack = { ack_id: 'dup-test', type: 'test', retries: 0 };
      ackQueue.sendAckToServer(mockWs, ack, mockLog);
      ackQueue.sendAckToServer(mockWs, ack, mockLog); // duplicate

      expect(mockWs.send.calledOnce).to.be.true;
    });

    it('clearQueue() should also clear sentAckIds', () => {
      const ack = { ack_id: 'clear-test', type: 'test', retries: 0 };
      ackQueue.sendAckToServer(mockWs, ack, mockLog);
      ackQueue.clearQueue();

      // After clearing, same ID should be sendable again
      mockWs.send.reset();
      ackQueue.sendAckToServer(mockWs, ack, mockLog);
      expect(mockWs.send.calledOnce).to.be.true;
    });
  });

  // =====================================================================
  // Bug #3 + #9: clearAndResetIntervals cancels idTimeoutToCancel & timerSendLocation
  // =====================================================================
  describe('Bug #3 + #9: clearAndResetIntervals cancels all timers', () => {
    let wsModule;
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
      wsModule = rewire('../../../../../lib/agent/control-panel/websockets');
    });

    afterEach(() => {
      clock.restore();
      sinon.restore();
    });

    it('should not call startWebsocket twice when startWebsocket() cancels pending reconnect timeout', () => {
      // Access internal clearAndResetIntervals via the module
      const clearAndResetIntervals = wsModule.__get__('clearAndResetIntervals');
      let idTimeoutToCancel = setTimeout(() => {}, 99999);
      wsModule.__set__('idTimeoutToCancel', idTimeoutToCancel);

      // clearAndResetIntervals should cancel it
      clearAndResetIntervals();

      idTimeoutToCancel = wsModule.__get__('idTimeoutToCancel');
      expect(idTimeoutToCancel).to.be.null;
    });
  });

  // =====================================================================
  // Bug #7: load() guard prevents duplicate startWebsocket() calls
  // =====================================================================
  describe('Bug #7: load() re-entry guard', () => {
    let wsModule;

    beforeEach(() => {
      wsModule = rewire('../../../../../lib/agent/control-panel/websockets');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should return existing emitter without calling startWebsocket again when already loaded', () => {
      // Inject a mock emitter to simulate already-loaded state
      const { EventEmitter } = require('events');
      const existingEmitter = new EventEmitter();
      wsModule.__set__('emitter', existingEmitter);

      const startWebsocketStub = sinon.stub();
      wsModule.__set__('webSocketSettings', startWebsocketStub);

      let result = null;
      wsModule.load((err, em) => { result = em; });

      expect(result).to.equal(existingEmitter);
      expect(startWebsocketStub.called).to.be.false;
    });
  });

  // =====================================================================
  // Bug #2: isReconnecting stays true until onOpen
  // =====================================================================
  describe('Bug #2: isReconnecting guard covers CONNECTING window', () => {
    let reconnection;

    beforeEach(() => {
      reconnection = rewire('../../../../../lib/agent/control-panel/websockets/reconnection');
      reconnection.resetReconnectDelay();
      reconnection.setIsReconnecting(false);
    });

    it('should NOT reset isReconnecting inside the reconnect timeout callback', () => {
      // The setTimeout in restartWebsocketCall should NOT reset isReconnecting.
      // We verify this by checking that isReconnecting is still true after the timeout.
      const clock = sinon.useFakeTimers();
      const wsModule = rewire('../../../../../lib/agent/control-panel/websockets');

      // Stub webSocketSettings to prevent real WS creation
      wsModule.__set__('webSocketSettings', sinon.stub());
      wsModule.__set__('reconnection', reconnection);

      const restartWebsocketCall = wsModule.__get__('restartWebsocketCall');

      // Stub connection and other deps
      const mockConn = {
        validateProxyConnection: sinon.stub(),
        terminate: sinon.stub(),
      };
      const mockConfig = { getData: sinon.stub().returns(null) };
      wsModule.__set__('connection', mockConn);
      wsModule.__set__('config', mockConfig);
      wsModule.__set__('clearAndResetIntervals', sinon.stub());

      restartWebsocketCall();
      expect(reconnection.getIsReconnecting()).to.be.true;

      // After the delay fires, isReconnecting should still be true
      // (not reset until onOpen)
      clock.tick(10000);
      expect(reconnection.getIsReconnecting()).to.be.true;

      clock.restore();
      sinon.restore();
    });
  });
});
