/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');

describe('Users_Provider', () => {
  let usersProvider;
  let osFunctionsStub;

  beforeEach(() => {
    // Clear module cache
    delete require.cache[require.resolve('../../../../../lib/agent/providers/users/index')];

    // Stub the OS-specific module
    const osModule = require(`../../../../../lib/agent/providers/users/${process.platform.replace('darwin', 'mac').replace('win32', 'windows')}`);
    osFunctionsStub = sinon.stub(osModule, 'get_users_list');

    usersProvider = require('../../../../../lib/agent/providers/users/index');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('get_users_list', () => {
    it('should work when called with only a callback (no options)', (done) => {
      osFunctionsStub.callsFake((cb) => {
        cb(null, ['user1', 'user2']);
      });

      usersProvider.get_users_list((err, users) => {
        expect(err).to.be.null;
        expect(users).to.deep.equal(['user1', 'user2']);
        done();
      });
    });

    it('should work when called with options and callback', (done) => {
      osFunctionsStub.callsFake((cb) => {
        cb(null, ['user1', 'user2']);
      });

      const options = { depth: 1, path: 'C:', user: 'C:' };
      usersProvider.get_users_list(options, (err, users) => {
        expect(err).to.be.null;
        expect(users).to.deep.equal(['user1', 'user2']);
        done();
      });
    });

    it('should propagate errors from OS function', (done) => {
      const osError = new Error('command failed');
      osFunctionsStub.callsFake((cb) => {
        cb(osError);
      });

      usersProvider.get_users_list((err) => {
        expect(err).to.equal(osError);
        done();
      });
    });

    it('should not crash when options is an object (malformed command scenario)', (done) => {
      osFunctionsStub.callsFake((cb) => {
        cb(null, ['user1']);
      });

      // This simulates the exact scenario from the bug:
      // providers.get calls getters["users_list"](options, getterCb)
      const malformedOptions = { depth: 1, path: 'C:', user: 'C:' };
      const callback = (err, users) => {
        expect(err).to.be.null;
        expect(users).to.deep.equal(['user1']);
        done();
      };

      // Should not throw "cb is not a function"
      expect(() => {
        usersProvider.get_users_list(malformedOptions, callback);
      }).to.not.throw();
    });
  });
});
