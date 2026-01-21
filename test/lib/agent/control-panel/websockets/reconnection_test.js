const { expect } = require('chai');
const websockets = require('../../../../../lib/agent/control-panel/websockets');

describe('WebSocket Reconnection', () => {
  describe('re_schedule initialization', () => {
    it('should have re_schedule set to true by default', () => {
      expect(websockets.re_schedule).to.equal(true);
    });
  });

  describe('concurrent reconnection prevention', () => {
    it('should export isReconnecting flag', () => {
      expect(websockets).to.have.property('isReconnecting');
    });

    it('isReconnecting should be false initially', () => {
      expect(websockets.isReconnecting).to.equal(false);
    });
  });

  describe('exponential backoff', () => {
    it('should export getReconnectDelay function', () => {
      expect(websockets.getReconnectDelay).to.be.a('function');
    });

    it('should export resetReconnectDelay function', () => {
      expect(websockets.resetReconnectDelay).to.be.a('function');
    });

    it('should return base delay on first call', () => {
      websockets.resetReconnectDelay();
      const delay = websockets.getReconnectDelay();
      // Base is 5000, with ±20% jitter = 4000-6000
      expect(delay).to.be.at.least(4000);
      expect(delay).to.be.at.most(6000);
    });

    it('should increase delay exponentially', () => {
      websockets.resetReconnectDelay();
      const delay1 = websockets.getReconnectDelay();
      const delay2 = websockets.getReconnectDelay();
      const delay3 = websockets.getReconnectDelay();

      // delay2 should be roughly 2x delay1 (accounting for jitter)
      expect(delay2).to.be.greaterThan(delay1 * 1.5);
      expect(delay3).to.be.greaterThan(delay2 * 1.5);
    });

    it('should cap at max delay', () => {
      websockets.resetReconnectDelay();
      // Call many times to reach max
      for (let i = 0; i < 20; i++) {
        websockets.getReconnectDelay();
      }
      const delay = websockets.getReconnectDelay();
      // Max is 300000 with ±20% jitter = 240000-360000
      expect(delay).to.be.at.most(360000);
    });
  });

  describe('Integration', () => {
    beforeEach(() => {
      websockets.resetReconnectDelay();
    });

    it('should have all reconnection mechanisms in place', () => {
      expect(websockets.re_schedule).to.equal(true);
      expect(websockets.isReconnecting).to.equal(false);
      expect(websockets.getReconnectDelay).to.be.a('function');
      expect(websockets.resetReconnectDelay).to.be.a('function');
    });
  });
});
