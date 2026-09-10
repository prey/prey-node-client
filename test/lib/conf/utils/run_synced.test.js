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
});
