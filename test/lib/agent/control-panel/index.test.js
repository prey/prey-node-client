/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const rewire = require('rewire');
const sinon = require('sinon');
const { expect } = require('chai');

describe('control-panel index: report 409 handling', function () {
  // First load of the control-panel module graph can be slow on a cold cache.
  this.timeout(20000);

  let cp;
  let deviceStateStub;
  let commandsStub;

  beforeEach(() => {
    cp = rewire('../../../../lib/agent/control-panel/index');
    deviceStateStub = {
      isMissingPending: sinon.stub(),
      flush: sinon.stub(),
      clear: sinon.stub().callsFake((cb) => cb && cb()),
    };
    commandsStub = { run: sinon.stub(), process: sinon.stub() };
    cp.__set__('deviceState', deviceStateStub);
    cp.__set__('commands', commandsStub);
  });

  afterEach(() => sinon.restore());

  it('re-asserts missing (does not recover) on report 409 while a missing state is pending', () => {
    deviceStateStub.isMissingPending.returns(true);
    const handleResponse = cp.__get__('handle_response');

    handleResponse('report', null, { statusCode: 409, headers: {} });

    expect(deviceStateStub.flush.calledOnce).to.be.true;
    // found() must NOT run: no stolen cancel, no state clear.
    expect(commandsStub.run.called).to.be.false;
    expect(deviceStateStub.clear.called).to.be.false;
  });

  it('recovers (found) on report 409 when no missing state is pending', () => {
    deviceStateStub.isMissingPending.returns(false);
    const handleResponse = cp.__get__('handle_response');

    handleResponse('report', null, { statusCode: 409, headers: {} });

    expect(commandsStub.run.calledWith('cancel', 'stolen')).to.be.true;
    expect(deviceStateStub.clear.calledOnce).to.be.true;
    expect(deviceStateStub.flush.called).to.be.false;
  });

  it('processes piggy-backed commands on a non-409 response', () => {
    const handleResponse = cp.__get__('handle_response');

    handleResponse('report', null, { statusCode: 200, headers: { 'X-Prey-Commands': '1' }, body: 'cmds' });

    expect(commandsStub.process.calledWith('cmds')).to.be.true;
    expect(commandsStub.run.called).to.be.false;
  });
});
