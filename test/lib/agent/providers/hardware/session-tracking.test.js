/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');

describe('Session Tracking (Linux)', () => {
  let linuxModule;
  let systemStub;
  let originalPlatform;

  before(() => {
    // Save original platform
    originalPlatform = process.platform;
    // Mock platform to be linux for these tests
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      writable: true,
      configurable: true
    });
  });

  after(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    });
  });

  beforeEach(() => {
    // Clear the module cache to get a fresh instance
    delete require.cache[require.resolve('../../../../../lib/agent/providers/hardware/linux')];
    linuxModule = rewire('../../../../../lib/agent/providers/hardware/linux');

    // Mock the system module
    systemStub = {
      get_session_type: sinon.stub(),
      get_session_display: sinon.stub()
    };

    linuxModule.__set__('system', systemStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('check_session_changes', () => {
    it('should return hasChanges: false on first call (no previous state)', (done) => {
      systemStub.get_session_type.callsFake((cb) => cb(null, 'x11'));
      systemStub.get_session_display.callsFake((cb) => cb(null, ':0'));

      linuxModule.check_session_changes((err, result) => {
        expect(err).to.be.null;
        expect(result).to.have.property('hasChanges');
        expect(result.hasChanges).to.be.false;
        expect(result.sessionType).to.equal('x11');
        expect(result.display).to.equal(':0');
        done();
      });
    });

    it('should return hasChanges: true when session type changes', (done) => {
      systemStub.get_session_type.onFirstCall().callsFake((cb) => cb(null, 'x11'));
      systemStub.get_session_display.onFirstCall().callsFake((cb) => cb(null, ':0'));

      // First call to establish baseline
      linuxModule.check_session_changes((err, result) => {
        expect(result.hasChanges).to.be.false;

        // Second call with changed session type
        systemStub.get_session_type.onSecondCall().callsFake((cb) => cb(null, 'wayland'));
        systemStub.get_session_display.onSecondCall().callsFake((cb) => cb(null, ':0'));

        linuxModule.check_session_changes((err2, result2) => {
          expect(err2).to.be.null;
          expect(result2.hasChanges).to.be.true;
          expect(result2.sessionType).to.equal('wayland');
          expect(result2.display).to.equal(':0');
          done();
        });
      });
    });

    it('should return hasChanges: true when display changes', (done) => {
      systemStub.get_session_type.onFirstCall().callsFake((cb) => cb(null, 'x11'));
      systemStub.get_session_display.onFirstCall().callsFake((cb) => cb(null, ':0'));

      // First call to establish baseline
      linuxModule.check_session_changes((err, result) => {
        expect(result.hasChanges).to.be.false;

        // Second call with changed display
        systemStub.get_session_type.onSecondCall().callsFake((cb) => cb(null, 'x11'));
        systemStub.get_session_display.onSecondCall().callsFake((cb) => cb(null, ':1'));

        linuxModule.check_session_changes((err2, result2) => {
          expect(err2).to.be.null;
          expect(result2.hasChanges).to.be.true;
          expect(result2.sessionType).to.equal('x11');
          expect(result2.display).to.equal(':1');
          done();
        });
      });
    });

    it('should return hasChanges: true when both session type and display change', (done) => {
      systemStub.get_session_type.onFirstCall().callsFake((cb) => cb(null, 'x11'));
      systemStub.get_session_display.onFirstCall().callsFake((cb) => cb(null, ':0'));

      // First call to establish baseline
      linuxModule.check_session_changes((err, result) => {
        expect(result.hasChanges).to.be.false;

        // Second call with both changed
        systemStub.get_session_type.onSecondCall().callsFake((cb) => cb(null, 'wayland'));
        systemStub.get_session_display.onSecondCall().callsFake((cb) => cb(null, ':1'));

        linuxModule.check_session_changes((err2, result2) => {
          expect(err2).to.be.null;
          expect(result2.hasChanges).to.be.true;
          expect(result2.sessionType).to.equal('wayland');
          expect(result2.display).to.equal(':1');
          done();
        });
      });
    });

    it('should return hasChanges: false when nothing changes', (done) => {
      systemStub.get_session_type.callsFake((cb) => cb(null, 'x11'));
      systemStub.get_session_display.callsFake((cb) => cb(null, ':0'));

      // First call to establish baseline
      linuxModule.check_session_changes((err, result) => {
        expect(result.hasChanges).to.be.false;

        // Second call with same values
        linuxModule.check_session_changes((err2, result2) => {
          expect(err2).to.be.null;
          expect(result2.hasChanges).to.be.false;
          expect(result2.sessionType).to.equal('x11');
          expect(result2.display).to.equal(':0');
          done();
        });
      });
    });

    it('should handle errors from get_session_type gracefully', (done) => {
      systemStub.get_session_type.callsFake((cb) => cb(new Error('Failed to get session type')));
      systemStub.get_session_display.callsFake((cb) => cb(null, ':0'));

      linuxModule.check_session_changes((err, result) => {
        expect(err).to.be.null;
        expect(result.hasChanges).to.be.false;
        expect(result.sessionType).to.be.null;
        expect(result.display).to.equal(':0');
        done();
      });
    });

    it('should handle errors from get_session_display gracefully', (done) => {
      systemStub.get_session_type.callsFake((cb) => cb(null, 'x11'));
      systemStub.get_session_display.callsFake((cb) => cb(new Error('Failed to get display')));

      linuxModule.check_session_changes((err, result) => {
        expect(err).to.be.null;
        expect(result.hasChanges).to.be.false;
        expect(result.sessionType).to.equal('x11');
        expect(result.display).to.be.null;
        done();
      });
    });
  });

  describe('exports', () => {
    it('should export check_session_changes function', () => {
      expect(linuxModule.check_session_changes).to.be.a('function');
    });

    it('should export get_session_type', () => {
      expect(linuxModule.get_session_type).to.exist;
    });

    it('should export get_session_display', () => {
      expect(linuxModule.get_session_display).to.exist;
    });
  });
});

describe('Hardware Index - Session Tracking Integration', () => {
  let hardwareIndex;
  let linuxModule;
  let hooksModule;
  let clock;

  beforeEach(() => {
    // Use fake timers to control setInterval
    clock = sinon.useFakeTimers();

    // Use rewire to inject mocked dependencies
    hardwareIndex = rewire('../../../../../lib/agent/providers/hardware/index');

    // Create mocked dependencies
    linuxModule = {
      check_session_changes: sinon.stub(),
      get_session_type: sinon.stub(),
      get_session_display: sinon.stub(),
      get_firmware_info: sinon.stub(),
      get_ram_module_list: sinon.stub()
    };

    hooksModule = {
      trigger: sinon.stub()
    };

    // Inject the mocks
    hardwareIndex.__set__('osFunctions', linuxModule);
    hardwareIndex.__set__('hooks', hooksModule);
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  describe('track_session_changes', () => {
    it('should be defined (function on Linux, null on other OS)', () => {
      const exp = hardwareIndex.__get__('exp');
      const osName = hardwareIndex.__get__('osName');

      if (osName === 'linux') {
        expect(exp.track_session_changes).to.be.a('function');
      } else {
        expect(exp.track_session_changes).to.be.null;
      }
    });

    it('should trigger hooks.trigger when hasChanges is true', () => {
      linuxModule.check_session_changes.callsFake((cb) => {
        cb(null, {
          hasChanges: true,
          sessionType: 'wayland',
          display: ':1'
        });
      });

      const exp = hardwareIndex.__get__('exp');

      // Call the track function
      if (exp.track_session_changes) {
        exp.track_session_changes();

        // Fast-forward time by 1 hour
        clock.tick(1000 * 60 * 60);

        // Verify hooks.trigger was called
        expect(hooksModule.trigger.called).to.be.true;
        expect(hooksModule.trigger.firstCall.args[0]).to.equal('data');
        expect(hooksModule.trigger.firstCall.args[1]).to.deep.equal({
          specs: {
            ubuntu_session_type: 'wayland',
            ubuntu_session_display: ':1'
          }
        });
      }
    });

    it('should NOT trigger hooks.trigger when hasChanges is false', () => {
      linuxModule.check_session_changes.callsFake((cb) => {
        cb(null, {
          hasChanges: false,
          sessionType: 'x11',
          display: ':0'
        });
      });

      const exp = hardwareIndex.__get__('exp');

      // Call the track function
      if (exp.track_session_changes) {
        exp.track_session_changes();

        // Fast-forward time by 1 hour
        clock.tick(1000 * 60 * 60);

        // Verify hooks.trigger was NOT called
        expect(hooksModule.trigger.called).to.be.false;
      }
    });

    it('should check session changes every hour', () => {
      linuxModule.check_session_changes.callsFake((cb) => {
        cb(null, {
          hasChanges: false,
          sessionType: 'x11',
          display: ':0'
        });
      });

      const exp = hardwareIndex.__get__('exp');

      // Call the track function
      if (exp.track_session_changes) {
        exp.track_session_changes();

        // Should not be called initially (no immediate check)
        expect(linuxModule.check_session_changes.callCount).to.equal(0);

        // Fast-forward 1 hour
        clock.tick(1000 * 60 * 60);
        expect(linuxModule.check_session_changes.callCount).to.equal(1);

        // Fast-forward another hour
        clock.tick(1000 * 60 * 60);
        expect(linuxModule.check_session_changes.callCount).to.equal(2);

        // Fast-forward another hour
        clock.tick(1000 * 60 * 60);
        expect(linuxModule.check_session_changes.callCount).to.equal(3);
      }
    });
  });
});
