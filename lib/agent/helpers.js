const semver = require('semver');

const helpers = {};

helpers.running_on_background = () => helpers.run_via_service() || helpers.no_console_attached();

// returns true if no terminal attached, or stdout is not a tty
helpers.no_console_attached = () => (!process.stdout.isTTY || process.env.TERM === 'dumb');

helpers.run_via_service = () => (process.platform === 'win32' && !process.env.HOMEPATH);

helpers.greaterOrEqual = (first, second) => {
  if (typeof first !== 'string' || typeof second !== 'string') return -1;
  const partsA = first.split('.').map((n) => parseInt(n, 10));
  const partsB = second.split('.').map((n) => parseInt(n, 10));
  const maxLength = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLength; i += 1) {
    const a = partsA[i] || 0;
    const b = partsB[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return true; // All parts are equal
};

const validateVersions = (versions) => {
  const invalidVersions = [];

  versions.forEach((el) => {
    if (!semver.valid(el)) {
      invalidVersions.push(el);
    }
  });

  return invalidVersions.length <= 0;
};

const semverWrapper = (methodName, first, second) => {
  const valid = validateVersions([first, second]);
  return valid && semver[methodName](first, second);
};
// is_greater_than("1.3.10", "1.3.9") returns true
helpers.is_greater_than = (first, second) => semverWrapper('gt', first, second);

helpers.is_greater_or_equal = (first, second) => semverWrapper('gte', first, second);

helpers.semverWrapper = semverWrapper;
module.exports = helpers;
