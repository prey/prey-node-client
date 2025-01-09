const { getUsersList } = require('../../utils/utilinformation');

/// /////////////////////////////////////////
// (c) 2019 Prey, Inc.
// By Javier Acuña - http://preyproject.com
// GPLv3 Licensed
/// /////////////////////////////////////////

module.exports.get_users_list = function (cb) {
  getUsersList((err, stdout) => {
    cb(err, stdout.trim().replaceAll('\r', '').split('\n'));
  });
};
