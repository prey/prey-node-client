/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const Module = require('module');

describe('tasks.activate (config activate)', () => {
  let tasks;
  let originalModuleLoad;
  let paths;
  let chmodrStub;
  let setCurrentStub;
  let postActivateStub;
  let putStub;

  beforeEach(() => {
    originalModuleLoad = Module._load;
    Module._load = function stubbedLoad(request, ...args) {
      if (request === 'firewall') return { remove_rule: () => {} };
      return originalModuleLoad.call(this, request, ...args);
    };

    tasks = rewire('../../../../lib/conf/tasks/index');

    paths = { config: '/etc/prey', current: '/opt/prey', versions: undefined };
    chmodrStub = sinon.stub().callsFake((p, mode, cb) => cb(null));
    setCurrentStub = sinon.stub().callsFake((version, cb) => cb(null));
    postActivateStub = sinon.stub().callsFake((cb) => cb(null));
    putStub = sinon.stub().callsFake((host, data, opts, cb) => cb(null, { statusCode: 200 }));

    tasks.__set__('paths', paths);
    tasks.chmodr = chmodrStub;
    tasks.__set__('shared', {
      log: sinon.stub(),
      version_manager: { set_current: setCurrentStub },
    });
    tasks.__set__('client', { put: putStub });
    tasks.__set__('osHooks', { post_activate: postActivateStub });
    tasks.__set__('fs', {
      appendFileSync: sinon.stub(),
      existsSync: sinon.stub().returns(true),
      mkdir: sinon.stub().callsFake((dir, cb) => cb()),
    });
  });

  afterEach(() => {
    Module._load = originalModuleLoad;
    sinon.restore();
  });

  describe('static install (no versions dir)', () => {
    it('does not chmod the package-manager-owned package dir', (done) => {
      tasks.activate({}, (err) => {
        expect(err).to.not.exist;
        expect(chmodrStub.called).to.be.false;
        done();
      });
    });

    it('still notifies the agent and runs the post_activate hooks', (done) => {
      tasks.activate({}, () => {
        expect(setCurrentStub.called).to.be.false;
        expect(putStub.calledOnce).to.be.true;
        expect(postActivateStub.calledOnce).to.be.true;
        done();
      });
    });
  });

  describe('versioned install', () => {
    beforeEach(() => {
      paths.current = '/usr/lib/prey/current';
      paths.versions = '/usr/lib/prey/versions';
    });

    it('sets the current version and chmods it (unchanged behaviour)', (done) => {
      tasks.activate({}, (err) => {
        expect(err).to.not.exist;
        expect(setCurrentStub.calledOnce).to.be.true;
        expect(chmodrStub.calledOnceWith('/usr/lib/prey/current', 0o755)).to.be.true;
        expect(postActivateStub.calledOnce).to.be.true;
        done();
      });
    });

    it('propagates chmodr errors without running the hooks', (done) => {
      chmodrStub.callsFake((p, mode, cb) => cb(new Error('EPERM')));
      tasks.activate({}, (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('EPERM');
        expect(postActivateStub.called).to.be.false;
        done();
      });
    });
  });
});
