/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const Module = require('module');
const path = require('path');

const SYSTEM_DIR = path.resolve(__dirname, '../../../../lib/system');
const SYSTEM_PATH = require.resolve(SYSTEM_DIR);

const missingGroup = () => Object.assign(new Error('Command failed: getent group'), { code: 2 });

/**
 * @param {Object<string, string>} groups group name -> getent output
 * @returns {sinon.SinonStub}
 */
const getentStub = (groups) => sinon.stub().callsFake((cmd, opts, cb) => {
  const match = /^getent group (\S+)$/.exec(cmd);
  if (!match) return cb(new Error(`unexpected command: ${cmd}`));
  if (!Object.prototype.hasOwnProperty.call(groups, match[1])) return cb(missingGroup(), '');
  return cb(null, groups[match[1]]);
});

describe('lib/system/linux find_admin_user', () => {
  let linux;
  let loggedUserStub;

  /**
   * @param {Object<string, string>} groups
   * @param {Error|null} loggedErr
   * @param {string} [loggedUser]
   */
  const setup = (groups, loggedErr, loggedUser) => {
    linux.__set__('exec', getentStub(groups));
    loggedUserStub.callsFake((cb) => cb(loggedErr, loggedUser));
  };

  beforeEach(() => {
    linux = rewire('../../../../lib/system/linux');
    loggedUserStub = sinon.stub();
    linux.find_logged_user = loggedUserStub;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('queries adm, wheel and sudo (in that order) with getent', (done) => {
    setup({}, null, 'jdoe');
    linux.find_admin_user(() => {
      const exec = linux.__get__('exec');
      expect(exec.args.map((call) => call[0])).to.deep.equal([
        'getent group adm',
        'getent group wheel',
        'getent group sudo',
      ]);
      done();
    });
  });

  it('returns the only member of wheel (first member is not dropped)', (done) => {
    setup({ wheel: 'wheel:x:10:jdoe\n' }, new Error("Couldn't find logged user."));
    linux.find_admin_user((err, user) => {
      expect(err).to.be.null;
      expect(user).to.equal('jdoe');
      done();
    });
  });

  it('keeps working on Ubuntu-style adm groups', (done) => {
    setup({ adm: 'adm:x:4:syslog,jdoe\n', sudo: 'sudo:x:27:jdoe\n' }, null, 'jdoe');
    linux.find_admin_user((err, user) => {
      expect(err).to.be.null;
      expect(user).to.equal('jdoe');
      done();
    });
  });

  it('falls through a missing adm group to a populated wheel group', (done) => {
    setup({ wheel: 'wheel:x:10:alice,bob\n' }, null, 'carol');
    linux.find_admin_user((err, user) => {
      expect(err).to.be.null;
      expect(user).to.equal('alice');
      done();
    });
  });

  it('prefers the logged user when it is an admin group member', (done) => {
    setup({ adm: 'adm:x:4:syslog,alice\n', wheel: 'wheel:x:10:bob\n' }, null, 'bob');
    linux.find_admin_user((err, user) => {
      expect(err).to.be.null;
      expect(user).to.equal('bob');
      done();
    });
  });

  it('ignores root, syslog, blanks and surrounding whitespace', (done) => {
    setup({ adm: 'adm:x:4:syslog, root ,,alice \n' }, null, 'zed');
    linux.find_admin_user((err, user) => {
      expect(err).to.be.null;
      expect(user).to.equal('alice');
      done();
    });
  });

  it('falls back to the logged user when every admin group is empty', (done) => {
    setup({ adm: 'adm:x:4:\n', wheel: 'wheel:x:10:\n', sudo: 'sudo:x:27:root\n' }, null, 'jdoe');
    linux.find_admin_user((err, user) => {
      expect(err).to.be.null;
      expect(user).to.equal('jdoe');
      done();
    });
  });

  it('does not fall back to a logged in root', (done) => {
    setup({ wheel: 'wheel:x:10:\n' }, null, 'root');
    linux.find_admin_user((err, user) => {
      expect(err).to.be.instanceOf(Error);
      expect(user).to.be.undefined;
      done();
    });
  });

  it("errors with \"Couldn't find admin user.\" when there is no candidate at all", (done) => {
    setup({ wheel: 'wheel:x:10:\n' }, new Error("Couldn't find logged user."));
    linux.find_admin_user((err, user) => {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal("Couldn't find admin user.");
      expect(user).to.be.undefined;
      done();
    });
  });

  it('calls back exactly once when find_logged_user fails (was called twice)', (done) => {
    setup({ wheel: 'wheel:x:10:jdoe\n' }, new Error("Couldn't find logged user."));
    const cb = sinon.stub();
    linux.find_admin_user(cb);

    setImmediate(() => {
      expect(cb.calledOnce).to.be.true;
      expect(cb.firstCall.args).to.deep.equal([null, 'jdoe']);
      done();
    });
  });

  it('calls back exactly once on the error path', (done) => {
    setup({}, new Error("Couldn't find logged user."));
    const cb = sinon.stub();
    linux.find_admin_user(cb);

    setImmediate(() => {
      expect(cb.calledOnce).to.be.true;
      expect(cb.firstCall.args[0]).to.be.instanceOf(Error);
      done();
    });
  });
});

describe('lib/system get_admin_user → linux find_admin_user (adapter path)', () => {
  let linux;
  let system;
  let savedCacheEntry;

  const loadSystem = () => {
    const platformRequest = path.join(SYSTEM_DIR, process.platform
      .replace('darwin', 'mac').replace('win32', 'windows'));
    const freshMemorize = rewire('memorize');
    const originalLoad = Module._load;
    Module._load = function stubbedLoad(request, parent, ...rest) {
      if (parent && parent.filename === SYSTEM_PATH) {
        if (request === platformRequest) return linux;
        if (request === 'memorize') return freshMemorize;
      }
      return originalLoad.call(this, request, parent, ...rest);
    };
    savedCacheEntry = require.cache[SYSTEM_PATH];
    try {
      delete require.cache[SYSTEM_PATH];
      // eslint-disable-next-line global-require, import/no-dynamic-require
      return require(SYSTEM_PATH);
    } finally {
      Module._load = originalLoad;
      if (savedCacheEntry) require.cache[SYSTEM_PATH] = savedCacheEntry;
      else delete require.cache[SYSTEM_PATH];
    }
  };

  beforeEach(() => {
    linux = rewire('../../../../lib/system/linux');
    linux.find_logged_user = sinon.stub();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('resolves the wheel member through system.get_admin_user', (done) => {
    linux.__set__('exec', getentStub({ wheel: 'wheel:x:10:jdoe\n' }));
    linux.find_logged_user.callsFake((cb) => cb(new Error("Couldn't find logged user.")));
    system = loadSystem();

    system.get_admin_user((err, user) => {
      expect(err).to.be.null;
      expect(user).to.equal('jdoe');
      done();
    });
  });

  it('resolves the logged user through system.get_admin_user when wheel is empty', (done) => {
    linux.__set__('exec', getentStub({ wheel: 'wheel:x:10:\n' }));
    linux.find_logged_user.callsFake((cb) => cb(null, 'jdoe'));
    system = loadSystem();

    system.get_admin_user((err, user) => {
      expect(err).to.be.null;
      expect(user).to.equal('jdoe');
      done();
    });
  });

  it('wraps the failure as NO_ADMIN_USER when nobody qualifies', (done) => {
    linux.__set__('exec', getentStub({}));
    linux.find_logged_user.callsFake((cb) => cb(new Error("Couldn't find logged user.")));
    system = loadSystem();

    system.get_admin_user((err, user) => {
      expect(err).to.be.instanceOf(Error);
      expect(err.code).to.equal('NO_ADMIN_USER');
      expect(err.message).to.include("Couldn't find admin user.");
      expect(user).to.be.undefined;
      done();
    });
  });
});
