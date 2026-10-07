/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const semver = require('semver');

// Read a package's installed version straight from its package.json on disk.
// Using fs (rather than require('<pkg>/package.json')) bypasses packages that
// restrict the './package.json' subpath via the "exports" field, e.g. chokidar 4.
const installedVersion = (pkg) => {
  const pkgJson = path.join(__dirname, '..', '..', 'node_modules', pkg, 'package.json');
  return JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version;
};

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
 * - chokidar       >= 4.0.3   (forced to v4 so the transitive `braces`
 *   stack-exhaustion DoS <=3.0.3 leaves the tree entirely; chokidar 4 drops the
 *   braces/fill-range dependency. mocha only loads chokidar in --watch mode,
 *   which this project does not use)
 * - http-cache-semantics >= 4.3.0 (max-stale handling cross-user cache
 *   disclosure; build-time only via sqlite3 -> node-gyp -> make-fetch-happen)
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
  chokidar: '4.0.3',
  'http-cache-semantics': '4.3.0',
};

describe('security: patched dependency versions', () => {
  Object.keys(MINIMUMS).forEach((pkg) => {
    const min = MINIMUMS[pkg];
    it(`${pkg} is >= ${min}`, () => {
      const installed = installedVersion(pkg);
      expect(
        semver.gte(installed, min),
        `${pkg}@${installed} is below the patched floor ${min}`,
      ).to.equal(true);
    });
  });

  // `braces` (<=3.0.3 stack-exhaustion DoS, no patched release) must stay out of
  // the tree. Forcing chokidar >= 4 removes the only path that pulled it in; this
  // guard fails if a future dependency reintroduces braces.
  it('braces is absent from the dependency tree', () => {
    expect(() => require.resolve('braces')).to.throw();
  });
});
