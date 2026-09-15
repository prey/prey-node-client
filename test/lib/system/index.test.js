'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

const SYSTEM_PATH = require.resolve('../../../lib/system');

describe('lib/system/index get_logged_user', () => {
  let clock;
  let system;
  let originalFind;
  let findStub;

  before(() => {
    clock = sinon.useFakeTimers();
  });

  after(() => {
    clock.restore();
  });

  beforeEach(() => {
    // get_logged_user holds its TTL cache and single-flight queue in module
    // scope, and other suites leave real lookups pending in that queue (a
    // queued caller is never called back, which reads here as a timeout).
    // Reload the module so every test starts with an empty cache and queue,
    // and take the exports fresh: other suites reload lib/system too, so a
    // reference captured earlier can point at a stale platform object.
    delete require.cache[SYSTEM_PATH];
    // eslint-disable-next-line global-require, import/no-dynamic-require
    system = require('../../../lib/system');

    originalFind = system.find_logged_user;
    findStub = sinon.stub();
    system.find_logged_user = findStub;
  });

  afterEach(() => {
    // find_logged_user lives on the shared platform module, so leaving the
    // stub in place would leak into every suite that runs after this one.
    system.find_logged_user = originalFind;
  });

  it('serves a second call from cache within the TTL (find runs once)', (done) => {
    findStub.callsFake((cb) => cb(null, 'alice'));

    system.get_logged_user((err1, user1) => {
      expect(err1).to.be.null;
      expect(user1).to.equal('alice');

      system.get_logged_user((err2, user2) => {
        expect(err2).to.be.null;
        expect(user2).to.equal('alice');
        expect(findStub.calledOnce).to.be.true;
        done();
      });
    });
  });

  it('re-queries once the TTL has expired', (done) => {
    findStub.callsFake((cb) => cb(null, 'alice'));

    system.get_logged_user(() => {
      clock.tick(4001); // TTL is 4000ms
      system.get_logged_user(() => {
        expect(findStub.calledTwice).to.be.true;
        done();
      });
    });
  });

  it('coalesces concurrent callers onto a single lookup (single-flight)', (done) => {
    let innerCb;
    findStub.callsFake((cb) => { innerCb = cb; }); // do not resolve yet

    const results = [];
    system.get_logged_user((err, user) => results.push(user));
    system.get_logged_user((err, user) => results.push(user));

    // Both calls are in flight; find was invoked exactly once.
    expect(findStub.calledOnce).to.be.true;

    innerCb(null, 'bob');
    expect(results).to.deep.equal(['bob', 'bob']);
    done();
  });

  it('does not cache errors and clears the pending queue', (done) => {
    findStub.onFirstCall().callsFake((cb) => cb(new Error('boom')));
    findStub.onSecondCall().callsFake((cb) => cb(null, 'carol'));

    system.get_logged_user((err1) => {
      expect(err1).to.be.instanceOf(Error);
      expect(err1.code).to.equal('NO_LOGGED_USER');

      // A subsequent call must re-run find (error was not cached).
      system.get_logged_user((err2, user2) => {
        expect(err2).to.be.null;
        expect(user2).to.equal('carol');
        expect(findStub.calledTwice).to.be.true;
        done();
      });
    });
  });

  it('bypasses the cache when bypassCache=true', (done) => {
    findStub.callsFake((cb) => cb(null, 'dave'));

    system.get_logged_user((err1, user1) => {
      expect(user1).to.equal('dave');
      // Valid cache exists, but bypass must still hit find.
      system.get_logged_user((err2, user2) => {
        expect(user2).to.equal('dave');
        expect(findStub.calledTwice).to.be.true;
        done();
      }, true);
    });
  });
});
