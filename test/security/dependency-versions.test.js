/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const semver = require('semver');

/**
 * Regression guard for security advisories remediated on this branch.
 * Each package must stay at or above the patched version. If a future
 * dependency change pulls one of these below its floor, this test fails.
 *
 * - @xmldom/xmldom >= 0.9.12  (serializer injection bypasses, creation-time
 *   line-terminator bypasses, several O(n^2) DoS parse paths, PI ReDoS,
 *   HTML raw-text output amplification, end-tag residue silent-accept)
 * - adm-zip        >= 0.6.1   (buffer over-allocation DoS; moves out of the
 *   symlink-traversal affected range <=0.6.0)
 * - qs             >= 6.16.0  (comma arrayLimit bypass, isBuffer TypeError DoS)
 */
const MINIMUMS = {
  '@xmldom/xmldom': '0.9.12',
  'adm-zip': '0.6.1',
  qs: '6.16.0',
};

describe('security: patched dependency versions', () => {
  Object.keys(MINIMUMS).forEach((pkg) => {
    const min = MINIMUMS[pkg];
    it(`${pkg} is >= ${min}`, () => {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const installed = require(`${pkg}/package.json`).version;
      expect(
        semver.gte(installed, min),
        `${pkg}@${installed} is below the patched floor ${min}`,
      ).to.equal(true);
    });
  });
});
