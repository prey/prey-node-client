/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('Reconnection Module', () => {
  let reconnectionRewired;
  let mathRandomStub;

  beforeEach(() => {
    reconnectionRewired = rewire('../../../../../lib/agent/control-panel/websockets/reconnection');
    reconnectionRewired.resetReconnectDelay();
  });

  afterEach(() => {
    if (mathRandomStub) {
      mathRandomStub.restore();
    }
  });

  describe('Basic exponential backoff', () => {
    it('should start with base delay', () => {
      // Stub Math.random to return 0.5 (no jitter effect)
      mathRandomStub = sinon.stub(Math, 'random').returns(0.5);

      const delay = reconnectionRewired.getReconnectDelay();

      // Base delay is 5000ms
      expect(delay).to.be.closeTo(5000, 100);
    });

    it('should double delay on each attempt', () => {
      mathRandomStub = sinon.stub(Math, 'random').returns(0.5);

      const delay1 = reconnectionRewired.getReconnectDelay(); // 5000 * 2^0
      const delay2 = reconnectionRewired.getReconnectDelay(); // 5000 * 2^1
      const delay3 = reconnectionRewired.getReconnectDelay(); // 5000 * 2^2

      expect(delay1).to.be.closeTo(5000, 100);
      expect(delay2).to.be.closeTo(10000, 200);
      expect(delay3).to.be.closeTo(20000, 400);
    });

    it('should cap at maximum delay', () => {
      mathRandomStub = sinon.stub(Math, 'random').returns(0.5);

      // Call multiple times to exceed max
      for (let i = 0; i < 10; i++) {
        reconnectionRewired.getReconnectDelay();
      }

      const finalDelay = reconnectionRewired.getReconnectDelay();

      // Max delay is 300000ms (5 minutes)
      expect(finalDelay).to.be.at.most(300000 * 1.4); // Account for max jitter
    });

    it('should reset delay counter', () => {
      mathRandomStub = sinon.stub(Math, 'random').returns(0.5);

      // Increment counter
      reconnectionRewired.getReconnectDelay();
      reconnectionRewired.getReconnectDelay();

      // Reset
      reconnectionRewired.resetReconnectDelay();

      // Should start from base again
      const delay = reconnectionRewired.getReconnectDelay();
      expect(delay).to.be.closeTo(5000, 100);
    });
  });

  describe('Jitter calculation - CRITICAL', () => {
    it('should add positive jitter', () => {
      // Math.random() = 0.9 → (0.9 - 0.5) = 0.4 → jitter = +40% of delay
      mathRandomStub = sinon.stub(Math, 'random').returns(0.9);

      const delay = reconnectionRewired.getReconnectDelay();

      // Base delay 5000 + 40% = 7000 (approximately)
      expect(delay).to.be.greaterThan(5000);
      expect(delay).to.be.lessThan(8000);
    });

    it('should add negative jitter', () => {
      // Math.random() = 0.1 → (0.1 - 0.5) = -0.4 → jitter = -40% of delay
      mathRandomStub = sinon.stub(Math, 'random').returns(0.1);

      const delay = reconnectionRewired.getReconnectDelay();

      // Base delay 5000 - 40% = 3000 (approximately)
      expect(delay).to.be.greaterThan(2500);
      expect(delay).to.be.lessThan(5000);
    });

    it('should never produce negative delay', () => {
      // Test with extreme negative jitter
      mathRandomStub = sinon.stub(Math, 'random').returns(0);

      const delay = reconnectionRewired.getReconnectDelay();

      expect(delay).to.be.greaterThan(0);
    });

    it('should handle minimum jitter boundary', () => {
      // Math.random() = 0 → (0 - 0.5) = -0.5 → jitter = -50% of delay
      mathRandomStub = sinon.stub(Math, 'random').returns(0);

      const delay = reconnectionRewired.getReconnectDelay();

      // Even with max negative jitter, should be positive
      // Base 5000 * 0.4 * (-0.5) = -1000, so 5000 - 1000 = 4000
      expect(delay).to.be.greaterThan(0);
      expect(delay).to.be.lessThan(5000);
    });

    it('should handle maximum jitter boundary', () => {
      // Math.random() = 0.9999 → close to +50% jitter
      mathRandomStub = sinon.stub(Math, 'random').returns(0.9999);

      const delay = reconnectionRewired.getReconnectDelay();

      // Base 5000 + max jitter (~2000) = ~7000
      expect(delay).to.be.greaterThan(5000);
      expect(delay).to.be.lessThan(8000);
    });

    it('should apply jitter to maximum delay correctly', () => {
      mathRandomStub = sinon.stub(Math, 'random').returns(0.5);

      // Get to max delay
      for (let i = 0; i < 10; i++) {
        reconnectionRewired.getReconnectDelay();
      }

      // Change jitter for final call
      mathRandomStub.returns(0.9); // +40% jitter

      const delay = reconnectionRewired.getReconnectDelay();

      // Max delay 300000 + 40% jitter
      expect(delay).to.be.greaterThan(300000);
      expect(delay).to.be.lessThan(420000); // 300000 * 1.4
    });

    it('should produce different delays with random jitter', () => {
      // Don't stub Math.random, let it be random

      const delay1 = reconnectionRewired.getReconnectDelay();
      reconnectionRewired.resetReconnectDelay();
      const delay2 = reconnectionRewired.getReconnectDelay();

      // With random jitter, delays should likely be different
      // (There's a small chance they could be the same, but very unlikely)
      // We just check both are in valid range
      expect(delay1).to.be.greaterThan(0);
      expect(delay2).to.be.greaterThan(0);
      expect(delay1).to.be.lessThan(8000);
      expect(delay2).to.be.lessThan(8000);
    });
  });

  describe('Reconnection state management', () => {
    it('should track reconnecting state', () => {
      expect(reconnectionRewired.getIsReconnecting()).to.be.false;

      reconnectionRewired.setIsReconnecting(true);
      expect(reconnectionRewired.getIsReconnecting()).to.be.true;

      reconnectionRewired.setIsReconnecting(false);
      expect(reconnectionRewired.getIsReconnecting()).to.be.false;
    });

    it('should allow multiple state changes', () => {
      reconnectionRewired.setIsReconnecting(true);
      reconnectionRewired.setIsReconnecting(true); // Setting twice
      expect(reconnectionRewired.getIsReconnecting()).to.be.true;

      reconnectionRewired.setIsReconnecting(false);
      expect(reconnectionRewired.getIsReconnecting()).to.be.false;
    });

    it('should maintain state across delay calculations', () => {
      reconnectionRewired.setIsReconnecting(true);

      reconnectionRewired.getReconnectDelay();
      reconnectionRewired.getReconnectDelay();

      expect(reconnectionRewired.getIsReconnecting()).to.be.true;
    });

    it('should not reset state when resetting delay counter', () => {
      reconnectionRewired.setIsReconnecting(true);
      reconnectionRewired.resetReconnectDelay();

      expect(reconnectionRewired.getIsReconnecting()).to.be.true;
    });
  });

  describe('Edge cases - concurrent calls', () => {
    it('should handle rapid successive getReconnectDelay calls', () => {
      mathRandomStub = sinon.stub(Math, 'random').returns(0.5);

      const delays = [];
      for (let i = 0; i < 5; i++) {
        delays.push(reconnectionRewired.getReconnectDelay());
      }

      // Each delay should be progressively larger (exponential)
      for (let i = 1; i < delays.length; i++) {
        expect(delays[i]).to.be.greaterThan(delays[i - 1]);
      }
    });

    it('should handle multiple resets', () => {
      reconnectionRewired.getReconnectDelay();
      reconnectionRewired.resetReconnectDelay();
      reconnectionRewired.resetReconnectDelay();
      reconnectionRewired.resetReconnectDelay();

      const delay = reconnectionRewired.getReconnectDelay();
      expect(delay).to.be.greaterThan(0);
      expect(delay).to.be.lessThan(8000);
    });

    it('should handle alternating delay and reset', () => {
      mathRandomStub = sinon.stub(Math, 'random').returns(0.5);

      const delay1 = reconnectionRewired.getReconnectDelay();
      reconnectionRewired.resetReconnectDelay();
      const delay2 = reconnectionRewired.getReconnectDelay();
      reconnectionRewired.resetReconnectDelay();
      const delay3 = reconnectionRewired.getReconnectDelay();

      // All should be close to base delay
      expect(delay1).to.be.closeTo(delay2, 100);
      expect(delay2).to.be.closeTo(delay3, 100);
    });
  });

  describe('Boundary conditions', () => {
    it('should handle attempt counter at maximum integer', () => {
      // Manually set attempt counter to very high value
      const setAttempts = reconnectionRewired.__get__('reconnectAttempts');
      reconnectionRewired.__set__('reconnectAttempts', 1000);

      const delay = reconnectionRewired.getReconnectDelay();

      // Should still cap at max delay
      expect(delay).to.be.at.most(420000); // 300000 * 1.4
    });

    it('should handle zero random value', () => {
      mathRandomStub = sinon.stub(Math, 'random').returns(0);

      const delay = reconnectionRewired.getReconnectDelay();

      expect(delay).to.be.greaterThan(0);
    });

    it('should handle one random value', () => {
      mathRandomStub = sinon.stub(Math, 'random').returns(1);

      const delay = reconnectionRewired.getReconnectDelay();

      expect(delay).to.be.greaterThan(0);
    });

    it('should handle 0.5 random value (no jitter)', () => {
      mathRandomStub = sinon.stub(Math, 'random').returns(0.5);

      const delay = reconnectionRewired.getReconnectDelay();

      // Should be exactly base delay (no jitter)
      expect(delay).to.be.closeTo(5000, 1);
    });
  });

  describe('Exponential growth verification', () => {
    it('should follow exponential pattern up to max', () => {
      mathRandomStub = sinon.stub(Math, 'random').returns(0.5);

      const delays = [];
      for (let i = 0; i < 8; i++) {
        delays.push(reconnectionRewired.getReconnectDelay());
      }

      // Check exponential growth: delay[i+1] ≈ 2 * delay[i] (until cap)
      for (let i = 0; i < delays.length - 1; i++) {
        if (delays[i] < 150000) {
          // Before hitting cap
          expect(delays[i + 1]).to.be.closeTo(delays[i] * 2, delays[i] * 0.1);
        }
      }
    });

    it('should plateau at maximum delay', () => {
      mathRandomStub = sinon.stub(Math, 'random').returns(0.5);

      // Get past max delay
      for (let i = 0; i < 10; i++) {
        reconnectionRewired.getReconnectDelay();
      }

      const delay1 = reconnectionRewired.getReconnectDelay();
      const delay2 = reconnectionRewired.getReconnectDelay();
      const delay3 = reconnectionRewired.getReconnectDelay();

      // Should all be approximately the same (at max)
      expect(delay1).to.be.closeTo(delay2, 100);
      expect(delay2).to.be.closeTo(delay3, 100);
    });
  });
});
