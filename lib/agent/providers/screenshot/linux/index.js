var system      = require('../../../../system'),
    run_as_user = system.run_as_logged_user,
    temp_path   = system.tempfile_path;

exports.get_screenshot = (callback) => {
  let file_path = temp_path('screenshot.' + process.pid + '.jpg');

  run_as_user('scrot', ['"' + file_path + '"'], (err) => {
    if (err) return callback(err);
    callback(null, file_path, 'image/jpeg')
  });
}
