/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('Connection Module', () => {
  let connectionRewired;
  let mockWs;
  let mockLogger;
  let MockWebSocket;

  beforeEach(() => {
    connectionRewired = rewire('../../../../../lib/agent/control-panel/websockets/connection');

    mockLogger = {
      info: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
    };

    // Minimal WebSocket mock
    mockWs = {
      readyState: 1,
      send: sinon.stub(),
      ping: sinon.stub(),
      pong: sinon.stub(),
      terminate: sinon.stub(),
      removeAllListeners: sinon.stub(),
      removeListener: sinon.stub(),
      on: sinon.stub(),
      once: sinon.stub(),
    };

    MockWebSocket = sinon.stub().returns(mockWs);
    connectionRewired.__set__('WebSocket', MockWebSocket);
    connectionRewired.__set__('HttpsProxyAgent', sinon.stub().returns({}));

    connectionRewired.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  const makeConfig = (overrides = {}) => ({
    protocol: 'https',
    host: 'panel.preyproject.com',
    deviceKey: 'abc123',
    apiKey: 'key456',
    userAgent: 'Prey/1.0',
    proxy: null,
    ...overrides,
  });

  // ==================== Bug #1 + #4: terminate ANY state, removeAllListeners ====================
  describe('Bug #1 + #4: orphan socket prevention', () => {
    it('should removeAllListeners and terminate existing socket in OPEN state before creating new one', () => {
      const firstWs = { ...mockWs, readyState: 1 };
      const secondWs = { ...mockWs, readyState: 0 };
      MockWebSocket.onCall(0).returns(firstWs);
      MockWebSocket.onCall(1).returns(secondWs);

      connectionRewired.create(makeConfig(), {}, mockLogger);
      connectionRewired.create(makeConfig(), {}, mockLogger);

      expect(firstWs.removeAllListeners.calledOnce).to.be.true;
      expect(firstWs.terminate.calledOnce).to.be.true;
    });

    it('should removeAllListeners and terminate existing socket in CONNECTING state (readyState=0)', () => {
      const connectingWs = { ...mockWs, readyState: 0 };
      const newWs = { ...mockWs, readyState: 0 };
      MockWebSocket.onCall(0).returns(connectingWs);
      MockWebSocket.onCall(1).returns(newWs);

      connectionRewired.create(makeConfig(), {}, mockLogger);
      // Second call — previous socket is CONNECTING, not OPEN
      connectionRewired.create(makeConfig(), {}, mockLogger);

      expect(connectingWs.removeAllListeners.calledOnce).to.be.true;
      expect(connectingWs.terminate.calledOnce).to.be.true;
    });

    it('should not terminate when no previous socket exists', () => {
      connectionRewired.create(makeConfig(), {}, mockLogger);
      // terminate() on mockWs should NOT have been called by create() itself
      expect(mockWs.terminate.called).to.be.false;
    });
  });

  // ==================== Bug #12: websocketConnected reset in terminate() ====================
  describe('Bug #12: websocketConnected reset in terminate()', () => {
    it('should set isConnected to false immediately on terminate()', () => {
      connectionRewired.create(makeConfig(), {
        onOpen: () => {},
      }, mockLogger);

      // Simulate onOpen firing
      connectionRewired.setConnected(true);
      expect(connectionRewired.isConnected()).to.be.true;

      connectionRewired.terminate();
      expect(connectionRewired.isConnected()).to.be.false;
    });

    it('should call removeAllListeners on terminate()', () => {
      connectionRewired.create(makeConfig(), {}, mockLogger);
      connectionRewired.terminate();
      expect(mockWs.removeAllListeners.called).to.be.true;
    });

    it('should not throw when terminate() called with no socket', () => {
      expect(() => connectionRewired.terminate()).to.not.throw();
      expect(connectionRewired.isConnected()).to.be.false;
    });

    it('terminateAndWait() should callback immediately when no socket exists', (done) => {
      connectionRewired.terminateAndWait(50, (closedByEvent) => {
        expect(closedByEvent).to.be.false;
        done();
      });
    });

    it('terminateAndWait() should wait for close event and callback true', (done) => {
      const closeCapableWs = {
        readyState: 1,
        send: sinon.stub(),
        ping: sinon.stub(),
        pong: sinon.stub(),
        terminate: sinon.stub(),
        removeAllListeners: sinon.stub(),
        on: sinon.stub(),
        once: sinon.stub().callsFake((event, cb) => {
          if (event === 'close') {
            setTimeout(cb, 0);
          }
        }),
        removeListener: sinon.stub(),
      };

      MockWebSocket.onCall(0).returns(closeCapableWs);

      connectionRewired.create(makeConfig(), {}, mockLogger);
      connectionRewired.terminateAndWait(100, (closedByEvent) => {
        expect(closedByEvent).to.be.true;
        expect(closeCapableWs.removeAllListeners.calledOnce).to.be.true;
        expect(closeCapableWs.terminate.calledOnce).to.be.true;
        done();
      });
    });
  });

  // ==================== Bug #13: connection generation counter ====================
  describe('Bug #13: connection generation counter', () => {
    it('should increment generation on each create()', () => {
      const gen0 = connectionRewired.getConnectionGeneration();
      connectionRewired.create(makeConfig(), {}, mockLogger);
      const gen1 = connectionRewired.getConnectionGeneration();
      connectionRewired.create(makeConfig(), {}, mockLogger);
      const gen2 = connectionRewired.getConnectionGeneration();

      expect(gen1).to.equal(gen0 + 1);
      expect(gen2).to.equal(gen0 + 2);
    });

    it('should ignore open event from stale socket (old generation)', () => {
      const onOpen1 = sinon.stub();
      const onOpen2 = sinon.stub();

      let firstOpenCb;
      const ws1 = {
        ...mockWs,
        on: (event, cb) => { if (event === 'open') firstOpenCb = cb; },
        removeAllListeners: sinon.stub(),
        terminate: sinon.stub(),
      };
      const ws2 = { ...mockWs };
      MockWebSocket.onCall(0).returns(ws1);
      MockWebSocket.onCall(1).returns(ws2);

      connectionRewired.create(makeConfig(), { onOpen: onOpen1 }, mockLogger);
      // Create second connection — generation bumped, ws1 is now stale
      connectionRewired.create(makeConfig(), { onOpen: onOpen2 }, mockLogger);

      // Stale socket's open event fires late
      if (firstOpenCb) firstOpenCb();

      expect(onOpen1.called).to.be.false;
    });

    it('should reset generation to 0 on reset()', () => {
      connectionRewired.create(makeConfig(), {}, mockLogger);
      connectionRewired.reset();
      expect(connectionRewired.getConnectionGeneration()).to.equal(0);
    });
  });

  // ==================== General connection behaviour ====================
  describe('create() general behaviour', () => {
    it('should call onOpen when open event fires', () => {
      const onOpen = sinon.stub();
      let openCb;
      mockWs.on = (event, cb) => { if (event === 'open') openCb = cb; };

      connectionRewired.create(makeConfig(), { onOpen }, mockLogger);
      openCb();

      expect(onOpen.calledOnce).to.be.true;
    });

    it('should set websocketConnected=true on open', () => {
      let openCb;
      mockWs.on = (event, cb) => { if (event === 'open') openCb = cb; };

      connectionRewired.create(makeConfig(), { onOpen: () => {} }, mockLogger);
      expect(connectionRewired.isConnected()).to.be.false;
      openCb();
      expect(connectionRewired.isConnected()).to.be.true;
    });

    it('should use wss protocol for https', () => {
      connectionRewired.create(makeConfig({ protocol: 'https' }), {}, mockLogger);
      expect(MockWebSocket.firstCall.args[0]).to.match(/^wss:\/\//);
    });

    it('should use ws protocol for http', () => {
      connectionRewired.create(makeConfig({ protocol: 'http' }), {}, mockLogger);
      expect(MockWebSocket.firstCall.args[0]).to.match(/^ws:\/\//);
    });
  });
});
