/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');

// Simulates child_process.exec throwing synchronously, as it does for spawn
// failures outside Node's async allowlist (e.g. `spawn EROFS` when the inherited
// cwd is read-only/invalid during an upgrade).
const throwingExec = () => { throw new Error('spawn EROFS'); };

describe('Hardware Windows Provider', () => {
  let windowsProvider;

  beforeEach(() => {
    windowsProvider = rewire('../../../../../lib/agent/providers/hardware/windows');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('spawn EROFS resilience (synchronous throw)', () => {
    it('get_ram_module_list delivers the throw as a callback error, never throwing', (done) => {
      windowsProvider.__set__('exec', throwingExec);

      expect(() => {
        windowsProvider.get_ram_module_list((err) => {
          expect(err).to.be.an('error');
          expect(err.message).to.match(/EROFS/);
          done();
        });
      }).to.not.throw();
    });

    it('get_osquery_running reports not-running on the throw, never throwing', (done) => {
      windowsProvider.__set__('exec', throwingExec);

      expect(() => {
        windowsProvider.get_osquery_running((err, running, key) => {
          expect(err).to.be.null;
          expect(running).to.be.false;
          expect(key).to.equal('osquery_running');
          done();
        });
      }).to.not.throw();
    });
  });

  describe('safe cwd on spawned children', () => {
    it('get_ram_module_list passes a cwd option to exec', () => {
      const execStub = sinon.stub();
      windowsProvider.__set__('exec', execStub);

      windowsProvider.get_ram_module_list(() => {});

      expect(execStub.calledOnce).to.be.true;
      const opts = execStub.firstCall.args[1];
      expect(opts).to.be.an('object');
      expect(opts.cwd).to.be.a('string').and.not.be.empty;
    });

    it('get_osquery_running passes a cwd option to exec', () => {
      const execStub = sinon.stub();
      windowsProvider.__set__('exec', execStub);

      windowsProvider.get_osquery_running(() => {});

      expect(execStub.calledOnce).to.be.true;
      const opts = execStub.firstCall.args[1];
      expect(opts).to.be.an('object');
      expect(opts.cwd).to.be.a('string').and.not.be.empty;
    });
  });
});
