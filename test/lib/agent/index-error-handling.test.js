/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
/* eslint-disable func-names */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');

// Builds an AggregateError like the one Node emits from internalConnectMultiple.
const aggregateWith = (code) => {
  const inner = new Error(`connect ${code} 10.0.0.1:443`);
  // @ts-ignore
  inner.code = code;
  const agg = new AggregateError([inner], `connect ${code}`);
  // @ts-ignore
  agg.code = code;
  return agg;
};

describe('agent/index — connection error handling (OWCA-637/641/642)', function () {
  this.timeout(20000);
  let agentIndex;
  let exceptionsSend;

  beforeEach(() => {
    agentIndex = rewire('../../../lib/agent/index');

    exceptionsSend = sinon.stub();
    // exceptions and logger are destructured from common at module top.
    agentIndex.__set__('exceptions', { send: exceptionsSend });
    agentIndex.__set__('logger', {
      error: sinon.stub(),
      notice: sinon.stub(),
      warn: sinon.stub(),
      info: sinon.stub(),
      debug: sinon.stub(),
    });
    // config drives handleError / connectionDown branches.
    agentIndex.__set__('config', {
      getData: (key) => key === 'send_crash_reports' || key === 'auto_connect',
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('isNetworkError', () => {
    ['EACCES', 'EADDRINUSE', 'ECONNABORTED'].forEach((code) => {
      it(`recognizes AggregateError[${code}] as a network error`, () => {
        const isNetworkError = agentIndex.__get__('isNetworkError');
        expect(isNetworkError(aggregateWith(code))).to.be.true;
      });
    });
  });

  describe('handleError', () => {
    it('does NOT report AggregateError connection failures to exceptions', () => {
      const handleError = agentIndex.__get__('handleError');
      handleError(aggregateWith('ECONNABORTED'), 'test');
      expect(exceptionsSend.called).to.be.false;
    });

    it('still reports genuinely unexpected errors to exceptions', () => {
      const handleError = agentIndex.__get__('handleError');
      const boom = new Error('unexpected boom');
      handleError(boom, 'test');
      expect(exceptionsSend.calledOnce).to.be.true;
    });
  });
});
