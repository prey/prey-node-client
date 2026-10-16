/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const notifications = require('../../../../../lib/agent/control-panel/websockets/notifications');

const context = () => ({
  ws: { readyState: 3, send: sinon.stub() },
  storage: { do: sinon.stub() },
  responseQueue: {
    findInQueue: sinon.stub().returns(null),
    addToQueue: sinon.stub(),
    addToMarkedToBePushed: sinon.stub(),
  },
  logger: { error() {}, debug() {}, info() {} },
});

describe('notifyAction migrate', () => {
  afterEach(() => sinon.restore());

  it('sends the operation as the reason', () => {
    const ctx = context();
    notifications.notifyAction(ctx, {
      status: 'stopped', id: '42', action: 'migrate', out: { phase: 'launched', operation_id: 'op1' },
    });
    const sent = ctx.responseQueue.addToQueue.firstCall.args[0];
    expect(sent.body.target).to.equal('migrate');
    expect(sent.body.reason).to.deep.equal({ phase: 'launched', operation_id: 'op1' });
  });

  it('keeps the token as the reason on error', () => {
    const ctx = context();
    notifications.notifyAction(ctx, {
      status: 'stopped', id: '42', action: 'migrate', err: new Error('download_failed'), out: { phase: 'failed', operation_id: 'op1' },
    });
    expect(ctx.responseQueue.addToQueue.firstCall.args[0].body.reason).to.equal('download_failed');
  });
});
