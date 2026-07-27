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
});
