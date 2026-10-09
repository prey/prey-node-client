/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const rewire = require('rewire');
const sinon = require('sinon');
const { expect } = require('chai');

const MAX_RESPONSE_AGE = 365 * 24 * 60 * 60 * 1000;

const errWithCode = (code) => {
  const e = new Error(code);
  e.code = code;
  return e;
};

describe('device-state', function () {
  // First load of `common`/systeminformation can be slow on a cold require cache.
  this.timeout(15000);

  let deviceState;
  let storageStub;
  let postMissingStub;
  let store; // in-memory row store keyed by id

  const makeStorage = () => {
    store = {};
    return {
      do: sinon.stub().callsFake((op, opts, cb) => {
        if (op === 'set') {
          store[opts.id] = { id: opts.id, ...opts.data };
          return cb && cb(null);
        }
        if (op === 'all') return cb && cb(null, Object.values(store));
        if (op === 'del') {
          delete store[opts.id];
          return cb && cb(null);
        }
        return cb && cb(null);
      }),
    };
  };

  beforeEach(() => {
    deviceState = rewire('../../../../lib/agent/control-panel/device-state');
    storageStub = makeStorage();
    postMissingStub = sinon.stub();
    deviceState.__set__('storage', storageStub);
    deviceState.__set__('api', { devices: { post_missing: postMissingStub } });
    deviceState.__set__('constants', { MAX_RESPONSE_AGE });
    deviceState.__set__('logger', {
      info: sinon.stub(), warn: sinon.stub(), debug: sinon.stub(), error: sinon.stub(),
    });
  });

  afterEach(() => sinon.restore());

  describe('setMissing', () => {
    it('persists the intent and posts missing=true', (done) => {
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('NETWORK_DOWN')));
      deviceState.setMissing(true, () => {
        expect(postMissingStub.calledOnceWith(true)).to.be.true;
        expect(store.current).to.exist;
        expect(store.current.missing).to.equal(1);
        expect(deviceState.isMissingPending()).to.be.true;
        done();
      });
    });

    it('keeps the row pending when delivery fails (offline)', (done) => {
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('NETWORK_DOWN')));
      deviceState.setMissing(true, () => {
        expect(store.current).to.exist;
        expect(deviceState.isMissingPending()).to.be.true;
        done();
      });
    });

    it('treats SAME_MISSING_STATE (201) as success and clears the row', (done) => {
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('SAME_MISSING_STATE')));
      deviceState.setMissing(true, () => {
        expect(store.current).to.not.exist;
        expect(deviceState.isMissingPending()).to.be.false;
        done();
      });
    });

    it('clears the row on success (200)', (done) => {
      postMissingStub.callsFake((missing, cb) => cb(null));
      deviceState.setMissing(true, () => {
        expect(store.current).to.not.exist;
        expect(deviceState.isMissingPending()).to.be.false;
        done();
      });
    });

    it('discards the intent on INVALID_CREDENTIALS (401)', (done) => {
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('INVALID_CREDENTIALS')));
      deviceState.setMissing(true, () => {
        expect(store.current).to.not.exist;
        expect(deviceState.isMissingPending()).to.be.false;
        done();
      });
    });

    it('a recover intent (missing=false) is not "missing pending"', (done) => {
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('NETWORK_DOWN')));
      deviceState.setMissing(false, () => {
        expect(store.current).to.exist;
        expect(store.current.missing).to.equal(0);
        expect(deviceState.isMissingPending()).to.be.false;
        done();
      });
    });

    it('recover supersedes an earlier missing (single row, latest wins)', (done) => {
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('NETWORK_DOWN')));
      deviceState.setMissing(true, () => {
        deviceState.setMissing(false, () => {
          expect(Object.keys(store)).to.have.lengthOf(1);
          expect(store.current.missing).to.equal(0);
          expect(deviceState.isMissingPending()).to.be.false;
          done();
        });
      });
    });
  });

  describe('flush', () => {
    it('does nothing when there is no pending intent', (done) => {
      deviceState.flush((err) => {
        expect(err).to.be.undefined;
        expect(postMissingStub.called).to.be.false;
        done();
      });
    });

    it('discards an intent older than MAX_RESPONSE_AGE', (done) => {
      store.current = {
        id: 'current', missing: 1, confirmed: 0, time: Date.now() - (MAX_RESPONSE_AGE + 1000), retries: 0,
      };
      deviceState.flush(() => {
        expect(store.current).to.not.exist;
        expect(postMissingStub.called).to.be.false;
        done();
      });
    });

    it('delivers a pending intent and clears it on success', (done) => {
      store.current = {
        id: 'current', missing: 1, confirmed: 0, time: Date.now(), retries: 0,
      };
      postMissingStub.callsFake((missing, cb) => cb(null));
      deviceState.flush(() => {
        expect(postMissingStub.calledOnceWith(true)).to.be.true;
        expect(store.current).to.not.exist;
        done();
      });
    });
  });

  describe('isMissingPending', () => {
    it('is false initially', () => {
      expect(deviceState.isMissingPending()).to.be.false;
    });
  });

  describe('loadFromStorage', () => {
    it('reports missingPending=false when there is no row', (done) => {
      deviceState.loadFromStorage((err, missingPending) => {
        expect(err).to.be.null;
        expect(missingPending).to.be.false;
        done();
      });
    });

    it('reports missingPending=true for a stored missing intent and retries delivery', (done) => {
      store.current = {
        id: 'current', missing: 1, confirmed: 0, time: Date.now(), retries: 0,
      };
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('NETWORK_DOWN')));
      deviceState.loadFromStorage((err, missingPending) => {
        expect(missingPending).to.be.true;
        expect(postMissingStub.calledWith(true)).to.be.true;
        done();
      });
    });
  });

  describe('clear', () => {
    it('removes the persisted intent', (done) => {
      store.current = {
        id: 'current', missing: 1, confirmed: 0, time: Date.now(), retries: 0,
      };
      deviceState.clear(() => {
        expect(store.current).to.not.exist;
        expect(deviceState.isMissingPending()).to.be.false;
        done();
      });
    });
  });
});
