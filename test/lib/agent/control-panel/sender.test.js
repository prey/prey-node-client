/* eslint-disable no-underscore-dangle */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('sender.notify_action migrate', () => {
  it('sends the operation as the reason', () => {
    const sender = rewire('../../../../lib/agent/control-panel/sender');
    const send = sinon.stub();
    sender.__set__('send', send);
    sender.notify_action('stopped', '42', 'migrate', {}, null, { phase: 'launched', operation_id: 'op1' });
    expect(send.firstCall.args[0]).to.equal('response');
    expect(send.firstCall.args[1].reason).to.deep.equal({ phase: 'launched', operation_id: 'op1' });
  });
});
