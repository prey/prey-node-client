/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('Status Trigger', () => {
  let statusModule;
  let providersStub;
  let hooksStub;
  let loggerStub;
  let clock;

  const mockStatus = {
    logged_user: 'testuser',
    battery_status: { percentage_remaining: '75' },
    network: { connected: true },
  };

  beforeEach(() => {
    providersStub = {
      get: sinon.stub(),
    };

    hooksStub = {
      on: sinon.stub(),
      remove: sinon.stub(),
      trigger: sinon.stub(),
    };

    loggerStub = {
      info: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      prefix: sinon.stub().returns({
        info: sinon.stub(),
        debug: sinon.stub(),
        warn: sinon.stub(),
        error: sinon.stub(),
      }),
    };

    statusModule = rewire('../../../../lib/agent/triggers/status/index');
    statusModule.__set__('providers', providersStub);
    statusModule.__set__('hooks', hooksStub);
    statusModule.__set__('logger', loggerStub.__set__
      ? loggerStub
      : statusModule.__get__('logger'));

    // Reset exported state
    statusModule.status = null;
    statusModule.statusCallbacks = [];
  });

  afterEach(() => {
    if (clock) {
      clock.restore();
      clock = null;
    }
    sinon.restore();
  });

  // =========================================================================
  // status_info
  // =========================================================================
  describe('status_info', () => {
    it('should fetch status from providers and cache it', (done) => {
      providersStub.get.callsFake((type, cb) => {
        expect(type).to.equal('status');
        cb(null, { ...mockStatus });
      });

      statusModule.status_info((err, status) => {
        expect(err).to.be.null;
        expect(status.logged_user).to.equal('testuser');
        expect(statusModule.status).to.deep.equal(status);
        done();
      });
    });

    it('should set logged_user to "null" if missing', (done) => {
      const statusWithoutUser = { battery_status: { percentage_remaining: '50' } };
      providersStub.get.callsFake((type, cb) => cb(null, statusWithoutUser));

      statusModule.status_info((err, status) => {
        expect(status.logged_user).to.equal('null');
        done();
      });
    });

    it('should still cache status on provider error', (done) => {
      providersStub.get.callsFake((type, cb) => cb(new Error('provider failed'), undefined));

      statusModule.status_info((err, status) => {
        expect(err).to.be.an('error');
        expect(status).to.be.undefined;
        expect(statusModule.status).to.be.undefined;
        done();
      });
    });

    it('should not throw when called without callback', () => {
      providersStub.get.callsFake((type, cb) => cb(null, { ...mockStatus }));
      expect(() => statusModule.status_info()).to.not.throw();
    });
  });

  // =========================================================================
  // checkBatteryStatus (via status_info)
  // =========================================================================
  describe('battery status check', () => {
    it('should trigger low_battery when percentage drops below threshold', (done) => {
      // First call: battery at 15%
      providersStub.get.onFirstCall().callsFake((type, cb) => {
        cb(null, { logged_user: 'u', battery_status: { percentage_remaining: '15' } });
      });

      statusModule.status_info(() => {
        // Second call: battery drops to 8%
        providersStub.get.onSecondCall().callsFake((type, cb) => {
          cb(null, { logged_user: 'u', battery_status: { percentage_remaining: '8' } });
        });

        statusModule.status_info(() => {
          expect(hooksStub.trigger.calledWith('low_battery')).to.be.true;
          done();
        });
      });
    });

    it('should not trigger low_battery if already below threshold', (done) => {
      // First call: already at 5%
      providersStub.get.onFirstCall().callsFake((type, cb) => {
        cb(null, { logged_user: 'u', battery_status: { percentage_remaining: '5' } });
      });

      statusModule.status_info(() => {
        // Second call: still at 3%
        providersStub.get.onSecondCall().callsFake((type, cb) => {
          cb(null, { logged_user: 'u', battery_status: { percentage_remaining: '3' } });
        });

        statusModule.status_info(() => {
          expect(hooksStub.trigger.calledWith('low_battery')).to.be.false;
          done();
        });
      });
    });

    it('should not crash when battery_status is missing', (done) => {
      providersStub.get.callsFake((type, cb) => {
        cb(null, { logged_user: 'u' });
      });

      statusModule.status_info((err, status) => {
        expect(err).to.be.null;
        expect(status).to.exist;
        done();
      });
    });
  });

  // =========================================================================
  // get_status
  // =========================================================================
  describe('get_status', () => {
    it('should return cached status immediately if available', (done) => {
      statusModule.status = { ...mockStatus };

      statusModule.get_status((err, status) => {
        expect(err).to.be.null;
        expect(status).to.deep.equal(mockStatus);
        expect(providersStub.get.called).to.be.false;
        done();
      });
    });

    it('should fetch fresh status when cache is empty', (done) => {
      statusModule.status = null;
      providersStub.get.callsFake((type, cb) => cb(null, { ...mockStatus }));

      statusModule.get_status((err, status) => {
        expect(err).to.be.null;
        expect(status.logged_user).to.equal('testuser');
        expect(statusModule.status).to.deep.equal(status);
        done();
      });
    });

    it('should resolve multiple queued callbacks when status arrives', (done) => {
      statusModule.status = null;
      let callCount = 0;

      // providers.get will be called but we delay the response
      providersStub.get.callsFake((type, cb) => {
        // Simulate async delay
        setTimeout(() => cb(null, { ...mockStatus }), 10);
      });

      const checkDone = () => {
        callCount++;
        if (callCount === 2) done();
      };

      statusModule.get_status((err, status) => {
        expect(status).to.exist;
        checkDone();
      }, 'cb1');

      statusModule.get_status((err, status) => {
        expect(status).to.exist;
        checkDone();
      }, 'cb2');
    });

    it('should return null when more than 5 callbacks are queued', (done) => {
      statusModule.status = null;
      // Don't resolve the provider call so callbacks accumulate
      providersStub.get.callsFake(() => {});

      // Queue 6 callbacks
      for (let i = 0; i < 6; i++) {
        statusModule.get_status(() => {}, `cb${i}`);
      }

      // The 7th should return null immediately
      statusModule.get_status((err, status) => {
        expect(status).to.be.null;
        done();
      });
    });

    it('should remove named callback from list when cache is available', (done) => {
      statusModule.status = { ...mockStatus };
      statusModule.statusCallbacks = [
        { cb: () => {}, nameCallBack: 'test_cb' },
        { cb: () => {}, nameCallBack: 'other_cb' },
      ];

      statusModule.get_status((err, status) => {
        expect(status).to.exist;
        const found = statusModule.statusCallbacks.find((el) => el.nameCallBack === 'test_cb');
        expect(found).to.be.undefined;
        done();
      }, 'test_cb');
    });

    it('should update existing named callback instead of duplicating', (done) => {
      statusModule.status = null;
      providersStub.get.callsFake((type, cb) => {
        setTimeout(() => cb(null, { ...mockStatus }), 10);
      });

      const originalCb = sinon.stub();
      statusModule.statusCallbacks = [{ cb: originalCb, nameCallBack: 'myCb' }];

      const newCb = (err, status) => {
        expect(status).to.exist;
        done();
      };

      statusModule.get_status(newCb, 'myCb');
    });

    it('should handle provider errors and pass them to callbacks', (done) => {
      statusModule.status = null;
      const providerError = new Error('provider down');
      providersStub.get.callsFake((type, cb) => cb(providerError, null));

      statusModule.get_status((err, status) => {
        expect(err).to.equal(providerError);
        done();
      });
    });
  });

  // =========================================================================
  // get_status timeout (3 minutes)
  // =========================================================================
  describe('get_status timeout', () => {
    beforeEach(() => {
      clock = sinon.useFakeTimers();
    });

    it('should call pending callbacks with null after timeout', (done) => {
      statusModule.status = null;
      statusModule.timeoutGetStatusMs = 100;

      // Provider never responds
      providersStub.get.callsFake(() => {});

      statusModule.get_status((err, status) => {
        expect(status).to.be.null;
        done();
      });

      clock.tick(150);
    });
  });

  // =========================================================================
  // verifyContent (via get_status)
  // =========================================================================
  describe('verifyContent', () => {
    it('should strip non-ASCII characters from status fields', (done) => {
      statusModule.status = null;
      const dirtyStatus = {
        logged_user: 'user\x00with\x01control\x02chars',
        hostname: 'clean-host',
      };

      providersStub.get.callsFake((type, cb) => cb(null, dirtyStatus));

      statusModule.get_status((err, status) => {
        expect(status.logged_user).to.not.include('\x00');
        expect(status.logged_user).to.not.include('\x01');
        expect(status.hostname).to.equal('clean-host');
        done();
      });
    });

    it('should handle null values in status without crashing', (done) => {
      statusModule.status = null;
      const statusWithNull = {
        logged_user: 'testuser',
        some_field: null,
        nested: { value: null, ok: 'fine' },
      };

      providersStub.get.callsFake((type, cb) => cb(null, statusWithNull));

      statusModule.get_status((err, status) => {
        expect(err).to.be.null;
        expect(status).to.exist;
        // null values are converted to '' by filterAllowedHttpChars
        expect(status.some_field).to.equal('');
        expect(status.nested.ok).to.equal('fine');
        done();
      });
    });
  });

  // =========================================================================
  // set_status
  // =========================================================================
  describe('set_status', () => {
    it('should update a specific field in cached status', () => {
      statusModule.status = { logged_user: 'old' };
      statusModule.set_status('logged_user', 'new_user');
      expect(statusModule.status.logged_user).to.equal('new_user');
    });

    it('should do nothing when status is null', () => {
      statusModule.status = null;
      expect(() => statusModule.set_status('logged_user', 'new_user')).to.not.throw();
      expect(statusModule.status).to.be.null;
    });
  });

  // =========================================================================
  // start
  // =========================================================================
  describe('start', () => {
    it('should register hooks and return an emitter', (done) => {
      statusModule.start({}, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.exist;
        expect(hooksStub.on.calledWith('connected')).to.be.true;
        expect(hooksStub.on.calledWith('disconnected')).to.be.true;
        expect(hooksStub.on.calledWith('network_state_changed')).to.be.true;
        done();
      });
    });

    it('should clear status on network_state_changed', (done) => {
      statusModule.start({}, () => {
        // Find the network_state_changed handler
        const call = hooksStub.on.getCalls().find((c) => c.args[0] === 'network_state_changed');
        statusModule.status = { ...mockStatus };

        // Execute the handler
        call.args[1]();
        expect(statusModule.status).to.be.null;
        done();
      });
    });

    it('should clear callbacks and intervals on disconnected', (done) => {
      statusModule.start({}, () => {
        const call = hooksStub.on.getCalls().find((c) => c.args[0] === 'disconnected');
        statusModule.statusCallbacks = [{ cb: () => {}, nameCallBack: 'test' }];

        call.args[1]();
        expect(statusModule.statusCallbacks).to.have.length(0);
        done();
      });
    });
  });

  // =========================================================================
  // stop
  // =========================================================================
  describe('stop', () => {
    it('should remove hooks and clean up state', (done) => {
      statusModule.start({}, (err, emitter) => {
        statusModule.status = { ...mockStatus };
        statusModule.statusCallbacks = [{ cb: () => {}, nameCallBack: 'test' }];

        statusModule.stop();

        expect(hooksStub.remove.calledWith('connected')).to.be.true;
        expect(hooksStub.remove.calledWith('disconnected')).to.be.true;
        expect(hooksStub.remove.calledWith('network_state_changed')).to.be.true;
        expect(statusModule.status).to.be.null;
        expect(statusModule.statusCallbacks).to.have.length(0);
        done();
      });
    });

    it('should not throw when called without a prior start', () => {
      expect(() => statusModule.stop()).to.not.throw();
    });
  });
});
