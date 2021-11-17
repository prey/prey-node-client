var join          = require('path').join,
    app           = join(__dirname, '..', '..', '..', 'utils', 'Prey.app'),
    common        = require('../../../common'),
    system        = common.system,
    run_as_user   = system.run_as_logged_user,
    gte           = common.helpers.is_greater_or_equal;

exports.get_location = function(cb) {
  system.get_os_version((err, version) => {
    if (version && gte(version, "10.6.0")) {
      var bin  = join(app, 'Contents', 'MacOS', 'Prey'),
          args = ['-location'];

      run_as_user(bin, args, {timeout: 5000}, (err, data) => {
        if (err || (data && data.includes('error'))) return cb(new Error('Unable to get native location'));
        let response;
        try {
          response =JSON.parse(data);
          return cb(null, response)
        } catch (err) {
          return cb(new Error(err.message))
        }
      })

    } else {
      return cb(new Error('Not yet supported'));
    }
  });
}