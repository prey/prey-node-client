/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('tasks.pre_uninstall orchestration', () => {
  let tasks;
  let daemonRemoveStub;
  let preUninstallStub;
  let deletePreyFenixStub;
  let deleteOsqueryStub;
  let deepCleanupStub;

  beforeEach(() => {
    tasks = rewire('../../../../lib/conf/tasks/index');

    daemonRemoveStub = sinon.stub().callsFake((cb) => cb());
    preUninstallStub = sinon.stub().callsFake((cb) => cb());
    deletePreyFenixStub = sinon.stub().callsFake((cb) => cb());
    deleteOsqueryStub = sinon.stub().callsFake((cb) => cb());
    deepCleanupStub = sinon.stub().callsFake((cb) => cb());

    tasks.__set__('isWindows', true);
    tasks.__set__('daemon', {
      remove: daemonRemoveStub,
    });
    tasks.__set__('osHooks', {
      pre_uninstall: preUninstallStub,
      deletePreyFenix: deletePreyFenixStub,
      deleteOsquery: deleteOsqueryStub,
      deep_cleanup: deepCleanupStub,
    });
    tasks.__set__('shared', {
      keys: {
        get: sinon.stub().returns({}),
      },
    });
    tasks.__set__('api', {
      keys: { set: sinon.stub() },
      push: { event: sinon.stub() },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('includes deep_cleanup when uninstall is not updating', (done) => {
    const values = {
      '-u': true,
      positional: ['false'],
    };

    tasks.pre_uninstall(values, (err) => {
      expect(err).to.equal(null);
      expect(daemonRemoveStub.calledOnce).to.equal(true);
      expect(preUninstallStub.calledOnce).to.equal(true);
      expect(deletePreyFenixStub.calledOnce).to.equal(true);
      expect(deleteOsqueryStub.calledOnce).to.equal(true);
      expect(deepCleanupStub.calledOnce).to.equal(true);
      done();
    });
  });

  it('skips deep_cleanup and module deactivation while updating', (done) => {
    const values = {
      '-u': true,
      positional: ['true'],
    };

    tasks.pre_uninstall(values, (err) => {
      expect(err).to.equal(null);
      expect(daemonRemoveStub.calledOnce).to.equal(true);
      expect(preUninstallStub.calledOnce).to.equal(true);
      expect(deletePreyFenixStub.called).to.equal(false);
      expect(deleteOsqueryStub.called).to.equal(false);
      expect(deepCleanupStub.called).to.equal(false);
      done();
    });
  });
});
