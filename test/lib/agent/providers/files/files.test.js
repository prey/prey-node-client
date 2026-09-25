/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');
const cp = require('child_process');

const START = '__PREY_TREE_START__';
const END = '__PREY_TREE_END__';

// These tests exercise get_tree on the current platform. The disambiguation and
// instrumentation logic is platform-agnostic (sentinel extraction, structured
// error payloads, retry, logging); the logged-user guard only runs on Windows.
const isWindows = process.platform === 'win32';

describe('Files_Provider get_tree', () => {
  let filesProvider;
  let common;
  let runAsUserStub;
  let getLoggedUserStub;
  let logger;

  const opts = { path: 'C:', depth: 1, user: 'tester' };

  beforeEach(() => {
    delete require.cache[require.resolve('../../../../../lib/agent/providers/files/index')];
    // eslint-disable-next-line global-require
    common = require('../../../../../lib/agent/common');

    logger = {
      warn: sinon.stub(), info: sinon.stub(), debug: sinon.stub(), error: sinon.stub(),
    };
    sinon.stub(common.logger, 'prefix').returns(logger);

    runAsUserStub = sinon.stub(common.system, 'run_as_user');
    getLoggedUserStub = sinon.stub(common.system, 'get_logged_user').callsFake((cb) => cb(null, 'tester'));
    // attr.js hidden-flag lookup (Windows happy path); harmless elsewhere.
    sinon.stub(cp, 'execSync').returns(Buffer.from('{"hidden":false}'));

    // eslint-disable-next-line global-require
    filesProvider = require('../../../../../lib/agent/providers/files/index');
  });

  afterEach(() => sinon.restore());

  it('returns [] for an empty (sentinel-wrapped) list without warning', (done) => {
    runAsUserStub.callsFake((o, cb) => cb(null, `${START}[]${END}`, ''));
    filesProvider.get_tree(opts, (err, out) => {
      expect(err).to.be.null;
      expect(out).to.equal('[]');
      expect(logger.warn.called).to.be.false;
      done();
    });
  });

  it('extracts the payload even with surrounding noise on stdout', (done) => {
    const payload = JSON.stringify([{ name: 'a.txt', path: 'C:\\a.txt' }]);
    runAsUserStub.callsFake((o, cb) => cb(null, `banner-noise${START}${payload}${END}trailing`, ''));
    filesProvider.get_tree(opts, (err, out) => {
      expect(err).to.be.null;
      const arr = JSON.parse(out);
      expect(arr).to.have.lengthOf(1);
      expect(arr[0].name).to.equal('a.txt');
      done();
    });
  });

  it('reports "Cannot read folder" on a structured error payload (unreadable dir)', (done) => {
    const payload = JSON.stringify({ error: 'EACCES', path: 'C:\\Users\\x\\Mis documentos' });
    runAsUserStub.callsFake((o, cb) => cb(null, `${START}${payload}${END}`, ''));
    filesProvider.get_tree(opts, (err) => {
      expect(err).to.be.an('error');
      expect(err.message).to.equal('Cannot read folder: EACCES');
      done();
    });
  });

  it('retries once then logs reason=tree-undefined on literal "undefined"', (done) => {
    runAsUserStub.callsFake((o, cb) => cb(null, 'undefined', ''));
    filesProvider.get_tree(opts, (err) => {
      expect(err.message).to.equal('Unable to parse files data');
      expect(runAsUserStub.callCount).to.equal(2); // original + 1 retry
      expect(logger.warn.calledWithMatch('reason=tree-undefined')).to.be.true;
      done();
    });
  });

  it('logs reason=empty-stdout when the child produced no output', (done) => {
    runAsUserStub.callsFake((o, cb) => cb(null, '', ''));
    filesProvider.get_tree(opts, (err) => {
      expect(err.message).to.equal('Unable to parse files data');
      expect(logger.warn.calledWithMatch('reason=empty-stdout')).to.be.true;
      done();
    });
  });

  it('logs reason=non-json-payload and captures stderr when payload is corrupt', (done) => {
    runAsUserStub.callsFake((o, cb) => cb(null, `${START}garbage{${END}`, 'child stderr text'));
    filesProvider.get_tree(opts, (err) => {
      expect(err.message).to.equal('Unable to parse files data');
      expect(logger.warn.calledWithMatch('reason=non-json-payload')).to.be.true;
      expect(logger.warn.calledWithMatch('child stderr text')).to.be.true;
      // A payload with sentinels is not retried.
      expect(runAsUserStub.callCount).to.equal(1);
      done();
    });
  });

  it('propagates a launcher error as-is', (done) => {
    const execErr = new Error('maxBuffer exceeded');
    runAsUserStub.callsFake((o, cb) => cb(execErr));
    filesProvider.get_tree(opts, (err) => {
      expect(err).to.equal(execErr);
      done();
    });
  });

  (isWindows ? it : it.skip)('fails fast when there is no logged user (locked session)', (done) => {
    const noUser = new Error('No logged user detected.');
    // @ts-ignore — attaching a runtime error code
    noUser.code = 'NO_LOGGED_USER';
    getLoggedUserStub.callsFake((cb) => cb(noUser));
    filesProvider.get_tree(opts, (err) => {
      expect(err.message).to.equal('No active session for file retrieval');
      expect(runAsUserStub.called).to.be.false;
      done();
    });
  });
});
