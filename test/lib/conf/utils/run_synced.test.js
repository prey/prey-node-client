/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const rewire = require('rewire');

describe('conf/utils/run_synced', () => {
  let runSynced;

  beforeEach(() => {
    runSynced = rewire('../../../../lib/conf/utils/run_synced');
  });

  afterEach(() => {
    sinon.restore();
  });

  const makeFakeChild = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = sinon.stub();
    return child;
  };

  it('reports a synchronous spawn throw (EROFS) through the callback instead of crashing', (done) => {
    runSynced.__set__('spawn', () => { throw new Error('spawn EROFS'); });

    runSynced('some_bin', ['config', 'activate'], {}, (err) => {
      expect(err).to.be.an('error');
      expect(err.message).to.contain('EROFS');
      done();
    });
  });

  it('returns the exit code on normal completion', (done) => {
    const child = makeFakeChild();
    runSynced.__set__('spawn', () => child);

    runSynced('some_bin', ['config', 'activate'], {}, (err, code) => {
      expect(err == null).to.equal(true);
      expect(code).to.equal(0);
      done();
    });

    child.emit('exit', 0);
  });

  it('reports child error events through the callback', (done) => {
    const child = makeFakeChild();
    runSynced.__set__('spawn', () => child);

    runSynced('some_bin', [], {}, (err) => {
      expect(err).to.be.an('error');
      done();
    });

    child.emit('error', new Error('ENOENT'));
  });

  it('does not crash when printing child stdout output triggers EPIPE', (done) => {
    const child = makeFakeChild();
    runSynced.__set__('spawn', () => child);

    const epipe = new Error('write EPIPE');
    epipe.code = 'EPIPE';
    sinon.stub(console, 'log').throws(epipe);

    runSynced('some_bin', [], {}, (err, code) => {
      expect(err == null).to.equal(true);
      expect(code).to.equal(0);
      done();
    });

    // The reader end of stdout closed mid-run: console.log throws EPIPE
    // synchronously. Emitting data must not propagate the throw.
    expect(() => child.stdout.emit('data', Buffer.from('some output\n'))).to.not.throw();
    child.emit('exit', 0);
  });

  it('does not crash when the exit-code log line triggers EPIPE', (done) => {
    const child = makeFakeChild();
    runSynced.__set__('spawn', () => child);

    const epipe = new Error('write EPIPE');
    epipe.code = 'EPIPE';
    sinon.stub(console, 'log').throws(epipe);

    runSynced('some_bin', [], {}, (err, code) => {
      expect(err == null).to.equal(true);
      expect(code).to.equal(3);
      done();
    });

    // done() prints "Exited with code N" before invoking cb; that write must
    // not crash the helper when stdout is broken.
    expect(() => child.emit('exit', 3)).to.not.throw();
  });
});
