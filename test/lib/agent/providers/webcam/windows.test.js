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

describe('Webcam Windows Provider', () => {
  let windowsProvider;

  beforeEach(() => {
    windowsProvider = rewire('../../../../../lib/agent/providers/webcam/windows/index');
    // fs.unlink is the entry gate of get_picture; resolve it immediately so the
    // spawn path runs synchronously within the test.
    windowsProvider.__set__('fs', {
      unlink: (file, cb) => cb(),
      existsSync: () => false,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('get_picture delivers a synchronous spawn throw as a callback error, never throwing', (done) => {
    windowsProvider.__set__('exec', throwingExec);

    expect(() => {
      windowsProvider.get_picture((err) => {
        expect(err).to.be.an('error');
        expect(err.message).to.match(/EROFS/);
        done();
      });
    }).to.not.throw();
  });

  it('get_picture passes a cwd option to exec', () => {
    const execStub = sinon.stub();
    windowsProvider.__set__('exec', execStub);

    windowsProvider.get_picture(() => {});

    expect(execStub.calledOnce).to.be.true;
    const opts = execStub.firstCall.args[1];
    expect(opts).to.be.an('object');
    expect(opts.cwd).to.be.a('string').and.not.be.empty;
  });
});
