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
 * - ip-address     >= 10.5.1  (SSRF guard bypasses: NAT64 local-use range
 *   64:ff9b:1::/48 unclassified, and isLinkLocal() matching fe80::/64 instead
 *   of fe80::/10)
 * - axios          >= 1.20.0  (form-serializer & http-adapter prototype-pollution
 *   read gadgets, fetch-adapter maxRedirects:0 SSRF bypass, NO_PROXY CIDR bypass)
 * - brace-expansion >= 5.0.10 (parseCommaParts native-stack-exhaustion DoS)
 * - markdown-it    >= 14.3.1  (two quadratic linkify DoS paths)
 * - js-yaml        >= 5.4.1   (merge-key empty-mapping CPU DoS budget bypass)
 * - moment         >= 2.31.0  (path traversal in moment.locale() with non-string
 *   input; further bypass of CVE-2022-24785)
 */
const MINIMUMS = {
  '@xmldom/xmldom': '0.9.12',
  'adm-zip': '0.6.1',
  qs: '6.16.0',
  'ip-address': '10.5.1',
  axios: '1.20.0',
  'brace-expansion': '5.0.10',
  'markdown-it': '14.3.1',
  'js-yaml': '5.4.1',
  moment: '2.31.0',
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
