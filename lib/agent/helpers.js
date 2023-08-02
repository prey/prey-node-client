const semver = require('semver');

// eslint-disable-next-line prefer-const
let helpers = {};

const validateVersions = (versions) => {
  // eslint-disable-next-line prefer-const
  let invalidVersions = [];

  versions.forEach((el) => {
    if (!semver.valid(el)) {
      invalidVersions.push(el);
    }
  });

  if (invalidVersions.length > 0) {
    return false;
  }
  return true;
};

const semverWrapper = (methodName, first, second) => {
  const valid = validateVersions([first, second]);
  return valid && semver[methodName](first, second);
};

helpers.runningOnBackground = () => helpers.runViaService() || helpers.noConsoleAttached();

// returns true if no terminal attached, or stdout is not a tty
helpers.noConsoleAttached = () => !process.stdout.isTTY || process.env.TERM === 'dumb';

helpers.runViaService = () => process.platform === 'win32' && !process.env.HOMEPATH;

// is_greater_than("1.3.10", "1.3.9") returns true
helpers.isGreaterThan = (first, second) => semverWrapper('gt', first, second);

helpers.isGreaterOrEqual = (first, second) => semverWrapper('gte', first, second);

module.exports = helpers;
