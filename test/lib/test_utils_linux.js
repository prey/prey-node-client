/**
 * TEST LIBRARY
 *
 * Prey Client
 *
 * Specific OSX Functions and Variables
 *
 */

// Module constructor
var os_utils = module.exports = function () {};

/**
 * @param   {String} username
 *
 * @summary  Returns command to grep the `username`
 *           from an output of the user list
 */
os_utils.grep_user_from_list_command = function (username) {
  return 'cat /etc/passwd | awk \'FS=":" {print $1}\' | grep ' + username;
}

/**
 * @param   {String} username
 *
 * @summary  Returns command to delete user
 */
os_utils.delete_user_command = function (username) {
  return 'userdel ' + username;
}

/**
 * @param   {String} username
 *
 * @summary  Returns information of `username`
 */
os_utils.get_user_info_command = function (username) {
  return 'id ' + username;
}

/**
 * @param   {String} username
 *
 * @summary  Returns the command to get the id of user `username`
 */
os_utils.get_test_user_id_command = function (username) {
  return 'awk -F":" \' /' + username  +'/ {print $3}\' /etc/passwd';
}

/**
 * @param   {String} username
 *
 * @summary  Returns the command to get a existing username
 *           (different from the parameter username)
 */
os_utils.get_existing_user_command = function (username) {
  var command = 'find /home -maxdepth 1 -not -path "*/\.*" '
              + '| grep -v ' + username + ' | tail -1 | cut -f3 -d "/"'

  return command;
}
