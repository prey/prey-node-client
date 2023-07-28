// this is basically a link to the shared system functions

const { system } = require('../../../common');

exports.get_logged_user = system.get_logged_user;
exports.get_os_info = system.get_os_info;
exports.get_os_name = system.get_os_name;
exports.get_os_version = system.get_os_version;
exports.get_current_hostname = system.get_current_hostname;
