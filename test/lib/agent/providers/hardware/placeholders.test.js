/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const { isMissing } = require('../../../../../lib/agent/providers/hardware/placeholders');

describe('hardware placeholders - isMissing', () => {
  it('treats failed or empty reads as missing', () => {
    [null, undefined, '', '   ', '-', ' - '].forEach((value) => {
      expect(isMissing(value), JSON.stringify(value)).to.be.true;
    });
  });

  it('keeps firmware filler strings as real values', () => {
    ['NA', 'N/A', 'None', 'Unknown', 'Default string', 'To be filled by O.E.M.', 'System Serial Number']
      .forEach((value) => {
        expect(isMissing(value), value).to.be.false;
      });
  });

  it('keeps non-string values as real values', () => {
    [0, false, true, {}, []].forEach((value) => {
      expect(isMissing(value), JSON.stringify(value)).to.be.false;
    });
  });
});
