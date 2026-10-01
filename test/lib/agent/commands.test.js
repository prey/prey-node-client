/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('commands', () => {
  let commandsModule;
  let hooksStub;

  beforeEach(() => {
    hooksStub = {
      trigger: sinon.stub(),
      on: sinon.stub(),
    };

    commandsModule = rewire('../../../lib/agent/commands');
    commandsModule.__set__('hooks', hooksStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('handleError (via perform adapter)', () => {
    it('should preserve Error message when triggering the error hook', () => {
      commandsModule.perform(null); // triggers handleError(new Error('No command received'))

      expect(hooksStub.trigger.calledOnce).to.be.true;
      const [event, err] = hooksStub.trigger.firstCall.args;
      expect(event).to.equal('error');
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('No command received');
    });

    it('should set level warn on the original Error object', () => {
      commandsModule.perform({ command: 'nonexistent_command' });

      expect(hooksStub.trigger.calledOnce).to.be.true;
      const [event, err] = hooksStub.trigger.firstCall.args;
      expect(event).to.equal('error');
      expect(err).to.be.instanceOf(Error);
      expect(err.level).to.equal('warn');
      expect(err.message).to.include('Unknown command');
    });
  });

  describe('perform: missing/recover routing', () => {
    let deviceStateStub;
    let reportsStub;
    let storageStub;

    beforeEach(() => {
      deviceStateStub = { setMissing: sinon.stub().callsFake((m, cb) => cb && cb()) };
      reportsStub = {
        get: sinon.stub(),
        cancel: sinon.stub(),
        running: sinon.stub().returns([]),
      };
      storageStub = { do: sinon.stub().callsFake((op, opts, cb) => cb && cb(null, [])) };
      commandsModule.__set__('deviceState', deviceStateStub);
      commandsModule.__set__('reports', reportsStub);
      commandsModule.__set__('storage', storageStub);
    });

    it('start/missing routes through deviceState.setMissing(true) and starts the stolen report', () => {
      commandsModule.perform({ command: 'start', target: 'missing', options: {} });

      expect(deviceStateStub.setMissing.calledOnce).to.be.true;
      expect(deviceStateStub.setMissing.firstCall.args[0]).to.equal(true);
      // command was rewritten to report/stolen
      expect(reportsStub.get.calledWith('stolen')).to.be.true;
    });

    it('start/recover routes through deviceState.setMissing(false) and cancels the stolen report', () => {
      commandsModule.perform({ command: 'start', target: 'recover', options: {} });

      expect(deviceStateStub.setMissing.calledOnce).to.be.true;
      expect(deviceStateStub.setMissing.firstCall.args[0]).to.equal(false);
      // command was rewritten to cancel/stolen
      expect(reportsStub.cancel.calledWith('stolen')).to.be.true;
    });
  });
});
