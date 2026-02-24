/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const Module = require('module');

describe('WiFi-On Trigger', () => {
  let wifiOnRewired;
  let hooksStub;
  let loggerStub;
  let configStub;
  let osFunctionsStub;
  let originalRequire;

  beforeEach(() => {
    // Mock hooks
    hooksStub = {
      on: sinon.stub(),
      remove: sinon.stub(),
    };

    // Mock logger
    loggerStub = {
      info: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };

    // Mock config
    configStub = {
      getData: sinon.stub(),
    };

    // Mock OS functions
    osFunctionsStub = {
      check_wifi: sinon.stub(),
      enable_wifi: sinon.stub(),
    };

    // Intercept require for linux.js
    originalRequire = Module.prototype.require;
    Module.prototype.require = function(id) {
      if (id === './linux') {
        return osFunctionsStub;
      }
      return originalRequire.apply(this, arguments);
    };

    wifiOnRewired = rewire('../../../../lib/agent/triggers/wifi-on/index');
    wifiOnRewired.__set__('hooks', hooksStub);
    wifiOnRewired.__set__('logger', loggerStub);
    wifiOnRewired.__set__('config', configStub);
  });

  afterEach(() => {
    // Restore original require
    if (originalRequire) {
      Module.prototype.require = originalRequire;
    }
    sinon.restore();
  });

  describe('start', () => {
    it('should start and set up hooks', (done) => {
      wifiOnRewired.__set__('os_name', 'linux');
      wifiOnRewired.__set__('os_functions', osFunctionsStub);
      osFunctionsStub.check_wifi.callsFake((cb) => cb(null, true));

      wifiOnRewired.start({}, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.exist;
        expect(hooksStub.on.calledWith('wifi_state_changed')).to.be.true;
        done();
      });
    });

    it('should check WiFi on startup', (done) => {
      wifiOnRewired.__set__('os_name', 'linux');
      wifiOnRewired.__set__('os_functions', osFunctionsStub);

      let checkCalled = false;
      osFunctionsStub.check_wifi.callsFake((cb) => {
        checkCalled = true;
        cb(null, true);
      });

      wifiOnRewired.start({}, () => {
        // Give time for ensureWifiEnabled to execute
        setTimeout(() => {
          expect(checkCalled).to.be.true;
          done();
        }, 10);
      });
    });
  });

  describe('ensureWifiEnabled', () => {
    beforeEach(() => {
      wifiOnRewired.__set__('os_name', 'linux');
      wifiOnRewired.__set__('os_functions', osFunctionsStub);
      configStub.getData.withArgs('force_wifi_on').returns(true);
    });

    it('should do nothing if WiFi is already enabled', (done) => {
      osFunctionsStub.check_wifi.callsFake((cb) => cb(null, true));

      wifiOnRewired.start({}, () => {
        // Give time for ensureWifiEnabled to complete
        setTimeout(() => {
          expect(loggerStub.debug.calledWith('WiFi is already enabled, nothing to do')).to.be.true;
          expect(osFunctionsStub.enable_wifi.called).to.be.false;
          done();
        }, 10);
      });
    });

    it('should enable WiFi when disabled', (done) => {
      let checkCallCount = 0;
      osFunctionsStub.check_wifi.callsFake((cb) => {
        checkCallCount++;
        if (checkCallCount === 1) {
          // First call: WiFi is disabled
          cb(null, false);
        } else {
          // Second call (verification): WiFi is now enabled
          cb(null, true);
        }
      });

      osFunctionsStub.enable_wifi.callsFake((cb) => {
        expect(loggerStub.warn.called).to.be.true;
        cb(null);
      });

      wifiOnRewired.start({}, () => {
        setTimeout(() => {
          expect(osFunctionsStub.enable_wifi.called).to.be.true;
          expect(loggerStub.info.calledWith(sinon.match(/WiFi successfully enabled/))).to.be.true;
          done();
        }, 50);
      });
    });

    it('should retry up to MAX_RETRIES times on failure', (done) => {
      let checkCallCount = 0;
      osFunctionsStub.check_wifi.callsFake((cb) => {
        checkCallCount++;
        if (checkCallCount === 1) {
          // Initial check: WiFi disabled
          cb(null, false);
        } else {
          // All verification checks: WiFi still disabled
          cb(null, false);
        }
      });

      osFunctionsStub.enable_wifi.callsFake((cb) => {
        // Enable succeeds but WiFi still shows as disabled
        cb(null);
      });

      wifiOnRewired.start({}, () => {
        setTimeout(() => {
          // Should have tried 3 times (MAX_RETRIES)
          expect(osFunctionsStub.enable_wifi.callCount).to.equal(3);
          expect(loggerStub.error.calledWith(sinon.match(/Maximum retry attempts/))).to.be.true;
          done();
        }, 100);
      });
    });

    it('should stop retrying after MAX_RETRIES', (done) => {
      let checkCallCount = 0;
      osFunctionsStub.check_wifi.callsFake((cb) => {
        checkCallCount++;
        // Always return false (WiFi disabled)
        cb(null, false);
      });

      osFunctionsStub.enable_wifi.callsFake((cb) => {
        // Enable command succeeds but WiFi stays disabled
        cb(null);
      });

      wifiOnRewired.start({}, () => {
        setTimeout(() => {
          // Should have attempted enable 3 times (MAX_RETRIES)
          expect(osFunctionsStub.enable_wifi.callCount).to.equal(3);
          // Check for the error message (not warning) after max retries
          const errorCalls = loggerStub.error.getCalls();
          const hasMaxRetriesError = errorCalls.some(call =>
            call.args[0] && call.args[0].includes('Maximum retry attempts') && call.args[0].includes('reached')
          );
          expect(hasMaxRetriesError).to.be.true;
          done();
        }, 200);
      });
    });

    it('should handle check_wifi errors gracefully', (done) => {
      osFunctionsStub.check_wifi.callsFake((cb) => {
        cb(new Error('Check WiFi error'));
      });

      wifiOnRewired.start({}, () => {
        setTimeout(() => {
          expect(loggerStub.error.calledWith(sinon.match(/Error checking WiFi state/))).to.be.true;
          expect(osFunctionsStub.enable_wifi.called).to.be.false;
          done();
        }, 10);
      });
    });

    it('should handle enable_wifi errors', (done) => {
      let checkCallCount = 0;
      osFunctionsStub.check_wifi.callsFake((cb) => {
        checkCallCount++;
        if (checkCallCount === 1) {
          cb(null, false); // WiFi disabled
        } else {
          cb(null, false); // Still disabled after error
        }
      });

      osFunctionsStub.enable_wifi.callsFake((cb) => {
        cb(new Error('Enable WiFi error'));
      });

      wifiOnRewired.start({}, () => {
        setTimeout(() => {
          expect(loggerStub.error.calledWith(sinon.match(/Failed to enable WiFi/))).to.be.true;
          done();
        }, 50);
      });
    });

    it('should reset retry counter when WiFi is enabled', (done) => {
      let checkCallCount = 0;
      osFunctionsStub.check_wifi.callsFake((cb) => {
        checkCallCount++;
        if (checkCallCount === 1) {
          cb(null, false); // First: disabled
        } else if (checkCallCount === 2) {
          cb(null, true); // After enable: enabled
        } else {
          cb(null, true); // Subsequent checks: still enabled
        }
      });

      osFunctionsStub.enable_wifi.callsFake((cb) => cb(null));

      wifiOnRewired.start({}, () => {
        setTimeout(() => {
          expect(loggerStub.debug.calledWith(sinon.match(/Resetting retry counter/))).to.be.true;
          done();
        }, 50);
      });
    });
  });

  describe('wifi_state_changed event', () => {
    it('should listen for wifi_state_changed events', (done) => {
      wifiOnRewired.__set__('os_name', 'linux');
      wifiOnRewired.__set__('os_functions', osFunctionsStub);
      osFunctionsStub.check_wifi.callsFake((cb) => cb(null, true));

      wifiOnRewired.start({}, () => {
        expect(hooksStub.on.calledWith('wifi_state_changed')).to.be.true;
        done();
      });
    });

    it('should reset retry counter on wifi_state_changed', (done) => {
      wifiOnRewired.__set__('os_name', 'linux');
      configStub.getData.withArgs('force_wifi_on').returns(true);
      wifiOnRewired.__set__('os_functions', osFunctionsStub);
      osFunctionsStub.check_wifi.callsFake((cb) => cb(null, true));

      wifiOnRewired.start({}, () => {
        // Get the callback registered for wifi_state_changed
        const wifiStateChangedCallback = hooksStub.on.getCall(0).args[1];

        // Trigger the event
        wifiStateChangedCallback();

        expect(loggerStub.debug.calledWith('WiFi state change detected, checking...')).to.be.true;
        done();
      });
    });
  });

  describe('stop', () => {
    it('should remove hooks and cleanup', (done) => {
      wifiOnRewired.__set__('os_name', 'linux');
      wifiOnRewired.__set__('os_functions', osFunctionsStub);
      osFunctionsStub.check_wifi.callsFake((cb) => cb(null, true));

      wifiOnRewired.start({}, () => {
        wifiOnRewired.stop();

        expect(hooksStub.remove.calledWith('wifi_state_changed')).to.be.true;
        done();
      });
    });

    it('should be callable without errors', () => {
      wifiOnRewired.stop();
      expect(hooksStub.remove.calledWith('wifi_state_changed')).to.be.true;
    });
  });

  describe('events', () => {
    it('should export empty events array', () => {
      expect(wifiOnRewired.events).to.be.an('array');
      expect(wifiOnRewired.events).to.be.empty;
    });
  });
});
