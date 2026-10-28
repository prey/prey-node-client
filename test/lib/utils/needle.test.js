/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const { parseNeedleBody } = require('../../../lib/utils/needle');

describe('lib/utils/needle', () => {
  describe('parseNeedleBody', () => {
    it('returns an already-parsed object unchanged', () => {
      const body = { enrolled: true, output: { code: 0 } };
      expect(parseNeedleBody(body)).to.equal(body);
    });

    it('returns an array body unchanged', () => {
      const body = [{ error: true }];
      expect(parseNeedleBody(body)).to.equal(body);
    });

    it('parses a valid JSON string into an object', () => {
      expect(parseNeedleBody('{"enrolled": true}')).to.deep.equal({ enrolled: true });
    });

    it('throws when the string is not valid JSON', () => {
      expect(() => parseNeedleBody('not-json')).to.throw();
    });

    it('returns null for a null body (JSON.parse(null) === null)', () => {
      expect(parseNeedleBody(null)).to.be.null;
    });

    it('throws for an undefined body', () => {
      expect(() => parseNeedleBody(undefined)).to.throw();
    });
  });
});
