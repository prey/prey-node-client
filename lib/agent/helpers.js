// @ts-check

const semver = require('semver');

const helpers = {};

helpers.running_on_background = () => helpers.run_via_service() || helpers.no_console_attached();

// returns true if no terminal attached, or stdout is not a tty
helpers.no_console_attached = () => (!process.stdout.isTTY || process.env.TERM === 'dumb');

helpers.run_via_service = () => (process.platform === 'win32' && !process.env.HOMEPATH);

// A dotted numeric version: "12", "24.04", "10.0.26100". Deliberately stricter
// than parseInt, which would read "1xx" as 1 and compare it as 1.0.0.
const VERSION_RE = /^\d+(\.\d+)*$/;

/**
 * Compares two dotted versions component by component, padding the shorter one
 * with zeros. Works on everything os_release actually holds ("24.04", "15.2",
 * "12") — which is exactly what semver.valid() rejects, since it demands three
 * components. Use this rather than semverWrapper for anything OS-version shaped.
 *
 * Trims first: wpxsvc's version reaches us as "2.0.35\r" on CRLF output
 * (lib/system/windows/index.js splits stdout on '\n' only).
 *
 * @param {unknown} first
 * @param {unknown} second
 * @returns {number|null} <0, 0 or >0 like a sort comparator; null when either
 *                        side is not a dotted numeric version
 */
const compareVersions = (first, second) => {
  if (typeof first !== 'string' || typeof second !== 'string') return null;
  const a = first.trim();
  const b = second.trim();
  if (!VERSION_RE.test(a) || !VERSION_RE.test(b)) return null;

  const partsA = a.split('.').map((n) => parseInt(n, 10));
  const partsB = b.split('.').map((n) => parseInt(n, 10));
  const maxLength = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLength; i += 1) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0; // All parts are equal
};

helpers.compareVersions = compareVersions;

/**
 * @param {unknown} first
 * @param {unknown} second
 * @returns {boolean} true when first >= second, false if either is unparseable
 */
helpers.greaterOrEqual = (first, second) => {
  const cmp = compareVersions(first, second);
  return cmp !== null && cmp >= 0;
};

/**
 * Which GTK build of the linux binaries this release needs. Ubuntu shipped
 * GTK4 from 24.04 on. An unknown release — lsb_release missing, so os_release
 * never got assigned — falls back to gtk3, the build that runs on more systems.
 *
 * Takes the version as an argument rather than reading common.os_release:
 * agent/common.js requires this module, so requiring it back would be circular.
 *
 * @param {string|undefined} osRelease value of common.os_release
 * @returns {'-gtk3'|'-gtk4'}
 */
helpers.gtkSuffix = (osRelease) => (
  helpers.greaterOrEqual(osRelease, '24.04') ? '-gtk4' : '-gtk3'
);

const validateVersions = (versions) => {
  const invalidVersions = [];

  versions.forEach((el) => {
    if (!semver.valid(el)) {
      invalidVersions.push(el);
    }
  });

  return invalidVersions.length <= 0;
};

/**
 * Strict semver only: returns false without comparing when either side is not
 * three-component. Prefer compareVersions for anything OS-version shaped —
 * "15.2" and "24.04" are not valid semver and would silently answer false here.
 */
const semverWrapper = (methodName, first, second) => {
  const valid = validateVersions([first, second]);
  return valid && semver[methodName](first, second);
};

/**
 * is_greater_than("1.3.10", "1.3.9") returns true
 *
 * @param {unknown} first
 * @param {unknown} second
 * @returns {boolean} true when first > second, false if either is unparseable
 */
helpers.is_greater_than = (first, second) => {
  const cmp = compareVersions(first, second);
  return cmp !== null && cmp > 0;
};

/**
 * Same meaning as greaterOrEqual since both moved onto compareVersions. The
 * name stays because six modules reach it through common.helpers; it delegates
 * instead of aliasing by reference so either one can still be stubbed alone.
 *
 * @param {unknown} first
 * @param {unknown} second
 * @returns {boolean}
 */
helpers.is_greater_or_equal = (first, second) => helpers.greaterOrEqual(first, second);

helpers.semverWrapper = semverWrapper;
module.exports = helpers;
