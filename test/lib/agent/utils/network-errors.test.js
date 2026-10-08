/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');

const { isConnectionError } = require('../../../../lib/agent/utils/network-errors');

// Builds an AggregateError shaped like the one Node emits from
// internalConnectMultiple (happy-eyeballs) when every connect() attempt fails.
const aggregateWith = (code, { topLevelCode = true } = {}) => {
  const inner = new Error(`connect ${code} 127.0.0.1:443`);
  // @ts-ignore - code is a standard Node SystemError field
  inner.code = code;
  const agg = new AggregateError([inner], `connect ${code}`);
  // @ts-ignore - Node sets .code on the AggregateError in newer versions
  if (topLevelCode) agg.code = code;
  return agg;
};

describe('utils/network-errors — isConnectionError', () => {
  describe('AggregateError from internalConnectMultiple (the reported errors)', () => {
    ['EACCES', 'EADDRINUSE', 'ECONNABORTED'].forEach((code) => {
      it(`returns true for AggregateError with top-level code ${code}`, () => {
        expect(isConnectionError(aggregateWith(code))).to.be.true;
      });

      it(`returns true for AggregateError whose only code is nested (.errors[0].code=${code})`, () => {
        expect(isConnectionError(aggregateWith(code, { topLevelCode: false }))).to.be.true;
      });
    });
  });

  describe('plain errors with a code', () => {
    it('returns true for a direct EADDRINUSE error', () => {
      const err = new Error('listen EADDRINUSE');
      // @ts-ignore
      err.code = 'EADDRINUSE';
      expect(isConnectionError(err)).to.be.true;
    });

    it('keeps recognizing the pre-existing network codes (ENETDOWN, ENOTFOUND)', () => {
      ['ENETDOWN', 'ENOTFOUND'].forEach((code) => {
        const err = new Error(code);
        // @ts-ignore
        err.code = code;
        expect(isConnectionError(err)).to.be.true;
      });
    });
  });

  describe('non connection errors', () => {
    it('returns false for an unrelated error code (EPIPE)', () => {
      const err = new Error('EPIPE');
      // @ts-ignore
      err.code = 'EPIPE';
      expect(isConnectionError(err)).to.be.false;
    });

    it('returns false for a plain error without code', () => {
      expect(isConnectionError(new TypeError('boom'))).to.be.false;
    });

    it('returns false for null/undefined', () => {
      expect(isConnectionError(null)).to.be.false;
      expect(isConnectionError(undefined)).to.be.false;
    });
  });
});
