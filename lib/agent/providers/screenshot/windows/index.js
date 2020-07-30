var join        = require('path').join,
    common      = require('./../../../common'),
    system      = common.system,
    run_as_user = system.run_as_logged_user,
    temp_path   = common.system.tempfile_path;

exports.get_screenshot = (callback) => {
  let file_path = temp_path('screenshot.' + process.pid + '.jpg');

  run_as_user('"' + join(__dirname, 'preyshot.exe') + '"', ['"' + file_path + '"'], () => {
    callback(null, file_path, 'image/jpeg')
  });
}