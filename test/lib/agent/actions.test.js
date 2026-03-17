/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('actions', () => {
  let actionsModule;
  let hooksStub;
  let loggerStub;

  beforeEach(() => {
    hooksStub = {
      trigger: sinon.stub(),
      emit: sinon.stub(),
    };

    loggerStub = {
      info: sinon.stub(),
      error: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub(),
    };

    actionsModule = rewire('../../../lib/agent/actions');
    actionsModule.__set__('hooks', hooksStub);
    actionsModule.__set__('logger', loggerStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('stopByName', () => {
    it('should stop a running action matching the given name', () => {
      const mockAction = { stop: sinon.stub() };
      const running = {
        'abc-123': { name: 'lock', action: mockAction },
      };
      actionsModule.__set__('running', running);

      actionsModule.stopByName('lock');

      expect(mockAction.stop.calledOnce).to.be.true;
    });

    it('should log and return when no running action matches the name', () => {
      actionsModule.__set__('running', {});

      actionsModule.stopByName('lock');

      expect(loggerStub.info.calledWith('No running action found with name: lock')).to.be.true;
    });

    it('should stop multiple running actions with the same name', () => {
      const mockAction1 = { stop: sinon.stub() };
      const mockAction2 = { stop: sinon.stub() };
      const running = {
        'id-1': { name: 'lock', action: mockAction1 },
        'id-2': { name: 'lock', action: mockAction2 },
      };
      actionsModule.__set__('running', running);

      actionsModule.stopByName('lock');

      expect(mockAction1.stop.calledOnce).to.be.true;
      expect(mockAction2.stop.calledOnce).to.be.true;
    });

    it('should not stop actions with a different name', () => {
      const mockLockAction = { stop: sinon.stub() };
      const mockAlarmAction = { stop: sinon.stub() };
      const running = {
        'id-1': { name: 'lock', action: mockLockAction },
        'id-2': { name: 'alarm', action: mockAlarmAction },
      };
      actionsModule.__set__('running', running);

      actionsModule.stopByName('lock');

      expect(mockLockAction.stop.calledOnce).to.be.true;
      expect(mockAlarmAction.stop.called).to.be.false;
    });

    it('should remove stopped actions from running', () => {
      const mockAction = { stop: sinon.stub() };
      const running = {
        'abc-123': { name: 'lock', action: mockAction },
      };
      actionsModule.__set__('running', running);

      actionsModule.stopByName('lock');

      const currentRunning = actionsModule.__get__('running');
      expect(currentRunning).to.not.have.property('abc-123');
    });
  });
});
