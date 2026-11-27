/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const rewire = require('rewire');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');

// Real sqlite3 on a temporary commands.db: direct storage.init() calls (as
// ensureAndCreateDb does in the conf CLI) racing with queued storage.do() calls
// must never hit a connection that another caller closed (SQLITE_MISUSE).
describe('storage concurrency (real sqlite3)', () => {
  const CONCURRENT = 40;
  let storage;
  let dir;
  let uncaught;
  let originalListeners;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prey-storage-'));
    storage = rewire('../../../../../lib/agent/utils/storage');
    storage.__set__('dbExists', () => dir);

    // Real sqlite3 reports a misused handle as an 'error' event with no listener,
    // which surfaces as an uncaught exception: capture it instead of crashing mocha.
    uncaught = [];
    originalListeners = process.listeners('uncaughtException');
    process.removeAllListeners('uncaughtException');
    process.on('uncaughtException', (err) => uncaught.push(err));
  });

  afterEach(() => {
    process.removeAllListeners('uncaughtException');
    originalListeners.forEach((l) => process.on('uncaughtException', l));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('runs direct init() calls and queued writes concurrently without misuse errors', function (done) {
    this.timeout(20000);
    const errors = [];
    let pending = CONCURRENT * 2;
    // A misused handle can swallow callbacks: fail with what was captured, not a bare timeout.
    const guard = setTimeout(() => {
      done(new Error(`stalled with ${pending} operations pending; uncaught: ${uncaught.map((e) => e.message).join(' | ')}`));
    }, 10000);
    const finish = () => {
      pending -= 1;
      if (pending > 0) return;
      clearTimeout(guard);
      storage.do('all', { type: 'keys' }, (err, rows) => {
        // Assertions throw inside a sqlite callback, where the capturing listener
        // above would swallow them: hand any failure to done() explicitly.
        try {
          expect(uncaught.map((e) => e.message)).to.deep.equal([]);
          expect(errors).to.deep.equal([]);
          expect(err).to.be.null;
          expect(rows).to.have.lengthOf(CONCURRENT);
          done();
        } catch (e) {
          done(e);
        }
      });
    };

    for (let i = 0; i < CONCURRENT; i += 1) {
      storage.init(null, null, (err, db) => {
        if (err) errors.push(err.message);
        if (db) db.close(finish);
        else finish();
      });
      storage.do('set', { type: 'keys', id: `k${i}`, data: { value: `v${i}` } }, (err) => {
        if (err) errors.push(String(err.message || err));
        finish();
      });
    }
  });
});
