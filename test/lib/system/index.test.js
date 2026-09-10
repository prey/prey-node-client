'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

// eslint-disable-next-line import/no-dynamic-require
const system = require('../../../lib/system');

describe('lib/system/index get_logged_user', () => {
  let clock;
  let originalFind;
  let findStub;

  before(() => {
    clock = sinon.useFakeTimers();
    originalFind = system.find_logged_user;
  });

  after(() => {
    clock.restore();
    system.find_logged_user = originalFind;
  });

  beforeEach(() => {
    // Advance past the 4s TTL so no cache leaks in from a previous test.
    clock.tick(10000);
    findStub = sinon.stub();
    system.find_logged_user = findStub;
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
