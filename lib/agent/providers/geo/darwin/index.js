const { join } = require('path');
const common = require('../../../common');

const app = join(__dirname, '..', '..', '..', 'utils', 'Prey.app');
const { system } = common;
const runAsUser = system.run_as_logged_user;
const { greaterOrEqual } = common.helpers;

exports.get_location = (cb) => {
  // eslint-disable-next-line consistent-return
  system.get_os_version((_err, version) => {
    if (version && greaterOrEqual(version, '10.6.0')) {
      const bin = join(app, 'Contents', 'MacOS', 'Prey');
      const args = ['-location'];
      try {
        runAsUser(bin, args, { timeout: 120000 }, (errRun, data) => {
          if (errRun || (data && data.includes('error'))) return cb(new Error('Unable to get native location'));
          let response;
          try {
            response = JSON.parse(data);
            if (Object.prototype.hasOwnProperty.call(response, 'accuracy')) response.accuracy = parseFloat(response.accuracy).toFixed(6);
            return cb(null, response);
          } catch (errExcept) {
            return cb(new Error(errExcept.message));
          }
        });
      } catch (err) {
        cb(new Error(err.message));
      }
    } else {
      return cb(new Error('Not yet supported'));
    }
  });
};
