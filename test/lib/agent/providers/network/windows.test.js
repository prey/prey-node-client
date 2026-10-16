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

describe('Network Windows Provider', () => {
  let windowsProvider;

  beforeEach(() => {
    windowsProvider = rewire('../../../../../lib/agent/providers/network/windows');
    // Force the Windows-version gate deterministically regardless of the host OS
    // running the suite (os.release() differs on CI).
    windowsProvider.__set__('release', 10);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('spawn EROFS resilience (synchronous throw)', () => {
    it('get_active_access_point delivers the throw as a callback error, never throwing', (done) => {
      windowsProvider.__set__('exec', throwingExec);

      expect(() => {
        windowsProvider.get_active_access_point((err) => {
          expect(err).to.be.an('error');
          expect(err.message).to.match(/EROFS/);
          done();
        });
      }).to.not.throw();
    });

    it('get_active_access_point_mac delivers the throw as a callback error, never throwing', (done) => {
      windowsProvider.__set__('exec', throwingExec);

      expect(() => {
        windowsProvider.get_active_access_point_mac((err) => {
          expect(err).to.be.an('error');
          expect(err.message).to.match(/EROFS/);
          done();
        });
      }).to.not.throw();
    });

    it('get_access_points_list delivers the throw through done(err), never throwing', (done) => {
      windowsProvider.__set__('exec', throwingExec);

      expect(() => {
        windowsProvider.get_access_points_list((err) => {
          expect(err).to.be.an('error');
          expect(err.message).to.match(/EROFS/);
          done();
        });
      }).to.not.throw();
    });
  });

  describe('spawn error family resilience (EPERM / ENOMEM / UNKNOWN)', () => {
    // The try/catch guard is code-agnostic: any synchronous spawn throw at
    // child arrival — not just EROFS — must be delivered as a callback error.
    ['spawn EPERM', 'spawn ENOMEM', 'spawn UNKNOWN'].forEach((code) => {
      it(`get_active_access_point delivers "${code}" as a callback error, never throwing`, (done) => {
        windowsProvider.__set__('exec', () => { throw new Error(code); });

        expect(() => {
          windowsProvider.get_active_access_point((err) => {
            expect(err).to.be.an('error');
            expect(err.message).to.equal(code);
            done();
          });
        }).to.not.throw();
      });
    });
  });

  describe('safe cwd on spawned children', () => {
    it('get_active_access_point passes a cwd option to exec', () => {
      const execStub = sinon.stub();
      windowsProvider.__set__('exec', execStub);

      windowsProvider.get_active_access_point(() => {});

      expect(execStub.calledOnce).to.be.true;
      const opts = execStub.firstCall.args[1];
      expect(opts).to.be.an('object');
      expect(opts.cwd).to.be.a('string').and.not.be.empty;
    });

    it('get_active_access_point_mac passes a cwd option to exec', () => {
      const execStub = sinon.stub();
      windowsProvider.__set__('exec', execStub);

      windowsProvider.get_active_access_point_mac(() => {});

      expect(execStub.calledOnce).to.be.true;
      const opts = execStub.firstCall.args[1];
      expect(opts).to.be.an('object');
      expect(opts.cwd).to.be.a('string').and.not.be.empty;
    });
  });
});
