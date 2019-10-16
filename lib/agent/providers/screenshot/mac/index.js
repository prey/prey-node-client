//////////////////////////////////////////
// Prey JS Screenshot Provider Mac Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var join = require('path').join,
    common = require('./../../../common');

if (common.os_release >= '10.15') {
  let app_path = join(__dirname, '..', '..', '..', 'utils', 'Prey.app');
  exports.screenshot_mac_cmd = `open -n ${app_path}`;

  common.system.get_logged_user((err, user) => {
    if (err || !user) {
      exports.screenshot_cmd = null;

    } else {
      let user_path       = `/Users/${user}`,
          screenshot_path = join(user_path, 'Library', 'Containers', 'com.preypatchmojave', 'Data', 'screenshot.jpg'),
          copy_cmd        = `cp ${screenshot_path}`;

      exports.screenshot_cmd = `${copy_cmd}`;
    }
  });

} else {
  exports.screenshot_cmd = "/usr/sbin/screencapture -t jpg -mx";
}
