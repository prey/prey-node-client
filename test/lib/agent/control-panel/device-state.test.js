/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const rewire = require('rewire');
const sinon = require('sinon');
const { expect } = require('chai');

const MAX_INTENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
        if (op === 'update') {
          if (store[opts.id]) {
            opts.columns.forEach((col, i) => { store[opts.id][col] = opts.values[i]; });
          }
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
    deviceState.__set__('logger', {
      info: sinon.stub(), warn: sinon.stub(), debug: sinon.stub(), error: sinon.stub(),
    });
  });

  afterEach(() => sinon.restore());

  describe('setMissing', () => {
    it('persists the intent and posts missing=true', (done) => {
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('ENETDOWN')));
      deviceState.setMissing(true, () => {
        expect(postMissingStub.calledOnceWith(true)).to.be.true;
        expect(store.current).to.exist;
        expect(store.current.missing).to.equal(1);
        expect(deviceState.isMissingPending()).to.be.true;
        done();
      });
    });

    it('keeps the row pending when delivery fails (offline)', (done) => {
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('ENETDOWN')));
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
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('ENETDOWN')));
      deviceState.setMissing(false, () => {
        expect(store.current).to.exist;
        expect(store.current.missing).to.equal(0);
        expect(deviceState.isMissingPending()).to.be.false;
        done();
      });
    });

    it('recover supersedes an earlier missing (single row, latest wins)', (done) => {
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('ENETDOWN')));
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

    it('discards an intent older than 7 days', (done) => {
      store.current = {
        id: 'current', missing: 1, confirmed: 0, time: Date.now() - (MAX_INTENT_AGE_MS + 1000), retries: 0,
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

  describe('bounded retries', () => {
    it('keeps an intent younger than 7 days', (done) => {
      store.current = {
        id: 'current', missing: 1, confirmed: 0, time: Date.now() - (MAX_INTENT_AGE_MS - 60000), retries: 0,
      };
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('ENETDOWN')));
      deviceState.flush(() => {
        expect(postMissingStub.calledOnce).to.be.true;
        expect(store.current).to.exist;
        done();
      });
    });

    it('a network error does not count as a rejection', (done) => {
      store.current = {
        id: 'current', missing: 1, confirmed: 0, time: Date.now(), retries: 0,
      };
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('ECONNREFUSED')));
      deviceState.flush(() => {
        expect(store.current.retries).to.equal(0);
        done();
      });
    });

    it('MISSING_KEY does not count as a rejection', (done) => {
      store.current = {
        id: 'current', missing: 1, confirmed: 0, time: Date.now(), retries: 0,
      };
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('MISSING_KEY')));
      deviceState.flush(() => {
        expect(store.current.retries).to.equal(0);
        done();
      });
    });

    const httpError = (statusCode) => Object.assign(errWithCode('UNKNOWN_RESPONSE'), { statusCode });

    [422, 404].forEach((status) => {
      it(`a panel rejection (HTTP ${status}) increments retries and keeps the row`, (done) => {
        store.current = {
          id: 'current', missing: 1, confirmed: 0, time: Date.now(), retries: 3,
        };
        postMissingStub.callsFake((missing, cb) => cb(httpError(status)));
        deviceState.flush((err) => {
          expect(err).to.be.an('error');
          expect(store.current).to.exist;
          expect(store.current.retries).to.equal(4);
          done();
        });
      });
    });

    [500, 502, 503, 504].forEach((status) => {
      it(`a server error (HTTP ${status}) is transient: retries unchanged, row kept`, (done) => {
        store.current = {
          id: 'current', missing: 1, confirmed: 0, time: Date.now(), retries: 9,
        };
        postMissingStub.callsFake((missing, cb) => cb(httpError(status)));
        deviceState.flush(() => {
          // One more rejection would discard it; a 5xx must not count.
          expect(store.current).to.exist;
          expect(store.current.retries).to.equal(9);
          done();
        });
      });
    });

    it('an error without an HTTP status is transient', (done) => {
      store.current = {
        id: 'current', missing: 1, confirmed: 0, time: Date.now(), retries: 0,
      };
      postMissingStub.callsFake((missing, cb) => cb(new Error('socket hang up')));
      deviceState.flush(() => {
        expect(store.current.retries).to.equal(0);
        done();
      });
    });

    it('discards the intent on the 10th rejection', (done) => {
      store.current = {
        id: 'current', missing: 1, confirmed: 0, time: Date.now(), retries: 9,
      };
      postMissingStub.callsFake((missing, cb) => cb(new Error('Invalid option for missing action')));
      deviceState.flush(() => {
        expect(store.current).to.not.exist;
        expect(deviceState.isMissingPending()).to.be.false;
        done();
      });
    });
  });

  describe('persist failure (read-only / locked DB)', () => {
    const failingSet = () => {
      const original = storageStub.do;
      storageStub.do = sinon.stub().callsFake((op, opts, cb) => {
        if (op === 'set') return cb(new Error('SQLITE_READONLY'));
        return original(op, opts, cb);
      });
    };

    it('still posts the state to the panel when the row cannot be written', (done) => {
      failingSet();
      postMissingStub.callsFake((missing, cb) => cb(null));
      deviceState.setMissing(true, (err) => {
        expect(err).to.be.undefined;
        expect(postMissingStub.calledOnceWith(true)).to.be.true;
        expect(deviceState.isMissingPending()).to.be.false;
        done();
      });
    });

    it('keeps the intent in memory and retries it on the next flush if delivery fails', (done) => {
      failingSet();
      postMissingStub.onFirstCall().callsFake((missing, cb) => cb(errWithCode('ENETDOWN')));
      postMissingStub.onSecondCall().callsFake((missing, cb) => cb(null));
      deviceState.setMissing(true, () => {
        expect(deviceState.isMissingPending()).to.be.true;
        deviceState.flush(() => {
          expect(postMissingStub.calledTwice).to.be.true;
          expect(postMissingStub.secondCall.args[0]).to.equal(true);
          expect(deviceState.isMissingPending()).to.be.false;
          done();
        });
      });
    });

    it('drops a memory-only intent older than 7 days', (done) => {
      deviceState.__set__('pendingMissing', {
        missing: true, confirmed: false, time: Date.now() - (MAX_INTENT_AGE_MS + 1000), retries: 0, memoryOnly: true,
      });
      deviceState.flush(() => {
        expect(postMissingStub.called).to.be.false;
        expect(deviceState.isMissingPending()).to.be.false;
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
      postMissingStub.callsFake((missing, cb) => cb(errWithCode('ENETDOWN')));
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
