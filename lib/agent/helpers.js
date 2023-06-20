const semver = require('semver');

let helpers = {};

function validateVersions(versions) {
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
}

function semverWrapper(methodName, first, second) {
  const valid = validateVersions([first, second]);

  return valid && semver[methodName](first, second);
}

helpers.running_on_background = () =>
  helpers.run_via_service() || helpers.no_console_attached();

// returns true if no terminal attached, or stdout is not a tty
helpers.no_console_attached = () =>
  !process.stdout.isTTY || process.env.TERM === 'dumb';

helpers.run_via_service = () =>
  process.platform === 'win32' && !process.env.HOMEPATH;

// is_greater_than("1.3.10", "1.3.9") returns true
helpers.is_greater_than = (first, second) => semverWrapper('gt', first, second);

helpers.is_greater_or_equal = (first, second) =>
  semverWrapper('gte', first, second);

module.exports = helpers;
