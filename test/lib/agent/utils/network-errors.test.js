/* eslint-disable no-undef */
const { expect } = require('chai');

const {
  isConnectionError,
  collectCodes,
  CONNECTION_ERROR_CODES,
} = require('../../../../lib/agent/utils/network-errors');

describe('network-errors helper', () => {
  describe('CONNECTION_ERROR_CODES', () => {
    it('includes the three OWCA write-error codes', () => {
      ['ECONNRESET', 'ECONNABORTED', 'EIO'].forEach((code) => {
        expect(CONNECTION_ERROR_CODES).to.include(code);
      });
    });

    it('includes EADDRNOTAVAIL (OWCA-648)', () => {
      expect(CONNECTION_ERROR_CODES).to.include('EADDRNOTAVAIL');
    });
  });

  describe('isConnectionError - by err.code', () => {
    it('returns true for ECONNRESET (OWCA-638)', () => {
      const err = new Error('boom');
      err.code = 'ECONNRESET';
      expect(isConnectionError(err)).to.equal(true);
    });

    it('returns true for ECONNABORTED (OWCA-646)', () => {
      const err = new Error('boom');
      err.code = 'ECONNABORTED';
      expect(isConnectionError(err)).to.equal(true);
    });

    it('returns true for EIO (OWCA-645)', () => {
      const err = new Error('boom');
      err.code = 'EIO';
      expect(isConnectionError(err)).to.equal(true);
    });

    it('returns true for the pre-existing ENETDOWN case', () => {
      const err = new Error('boom');
      err.code = 'ENETDOWN';
      expect(isConnectionError(err)).to.equal(true);
    });

    it('returns true for EADDRNOTAVAIL (OWCA-648)', () => {
      const err = new Error('boom');
      err.code = 'EADDRNOTAVAIL';
      expect(isConnectionError(err)).to.equal(true);
    });
  });

  describe('isConnectionError - by message form (no code set)', () => {
    // These are the exact production signatures from the OWCA reports.
    it('returns true for "write ECONNRESET" (OWCA-638)', () => {
      expect(isConnectionError(new Error('write ECONNRESET'))).to.equal(true);
    });

    it('returns true for "write EIO" (OWCA-645)', () => {
      expect(isConnectionError(new Error('write EIO'))).to.equal(true);
    });

    it('returns true for "write ECONNABORTED" (OWCA-646)', () => {
      expect(isConnectionError(new Error('write ECONNABORTED'))).to.equal(true);
    });

    it('returns true for the pre-existing "read ENETDOWN" case', () => {
      expect(isConnectionError(new Error('read ENETDOWN'))).to.equal(true);
    });

    it('returns true for "read EADDRNOTAVAIL" (OWCA-648)', () => {
      expect(isConnectionError(new Error('read EADDRNOTAVAIL'))).to.equal(true);
    });
  });

  describe('isConnectionError - AggregateError (happy-eyeballs)', () => {
    it('returns true when a nested error carries a connection code', () => {
      const inner = new Error('connect failed');
      inner.code = 'ECONNRESET';
      const agg = new AggregateError([inner], 'all attempts failed');
      expect(isConnectionError(agg)).to.equal(true);
    });

    it('returns false when no nested error carries a connection code', () => {
      const inner = new Error('nope');
      inner.code = 'ERR_SOMETHING';
      const agg = new AggregateError([inner], 'all attempts failed');
      expect(isConnectionError(agg)).to.equal(false);
    });
  });

  describe('isConnectionError - negative / defensive cases', () => {
    it('returns false for an unrelated coded error', () => {
      const err = new Error('boom');
      err.code = 'ERR_INVALID_ARG_TYPE';
      expect(isConnectionError(err)).to.equal(false);
    });

    it('returns false for a plain error with no code and unrelated message', () => {
      expect(isConnectionError(new Error('something bad'))).to.equal(false);
    });

    it('returns false for null / undefined / non-Error input', () => {
      expect(isConnectionError(null)).to.equal(false);
      expect(isConnectionError(undefined)).to.equal(false);
      expect(isConnectionError('write ECONNRESET')).to.equal(false);
      expect(isConnectionError({})).to.equal(false);
    });
  });

  describe('collectCodes', () => {
    it('collects the top-level code', () => {
      const err = new Error('boom');
      err.code = 'ECONNRESET';
      expect(collectCodes(err)).to.include('ECONNRESET');
    });

    it('collects nested AggregateError codes', () => {
      const inner = new Error('inner');
      inner.code = 'EHOSTUNREACH';
      const agg = new AggregateError([inner], 'agg');
      agg.code = 'EIO';
      const codes = collectCodes(agg);
      expect(codes).to.include('EIO');
      expect(codes).to.include('EHOSTUNREACH');
    });

    it('returns an empty array for non-Error input', () => {
      expect(collectCodes(null)).to.deep.equal([]);
      expect(collectCodes('x')).to.deep.equal([]);
    });
  });
});
