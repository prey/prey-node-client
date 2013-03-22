/**
 * TEST LIBRARY
 *
 * Prey Client
 *
 * Generic Functions
 *
 */

// Module requirements
var exec_process  = require('child_process').exec,
    spawn_process = require('child_process').spawn,
    os_name       = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_utils      = require('./test_utils_' + os_name);

// Module constructor
var utils = module.exports = function () {};

/**
 * @param   {String}    command
 * @param   {Callback}  callback
 *
 * @summary Encapsulates and executes a command
 */
utils.execute_command = function (command, callback) {
  exec_process(command, executed);

  function executed (error, stdout, stderr) {
    if (error !== null) {
      if (stdout) return callback(stdout);
      return callback(error);
    }
    if (stderr !== '') return callback(stderr);
    return callback(null, stdout);
  }
}

/**
 * @param   {String}    command
 * @param   {Array}     args
 * @param   {Object}    options
 * @param   {Callback}  callback
 *
 * @summary Encapsulates and executes a command using child_process#spawn
 */
utils.spawn_command = function (command, args, options, callback) {
  try {
    var cmd       = spawn_process(command, args, options),
        error     = '',
        response  = '';

    cmd.stdout.on('data', function (data) {
      response += data.toString('utf8');
    });

    cmd.stderr.on('data', function (data) {
      error += data.toString('utf8');
    });

    cmd.on('exit', function (code) {
      if (error !== '') return callback(error);
      return callback(null, response);
    });
  } catch (e) {
    return callback(e);
  }
}

/**
 * @param   {String}    username
 * @param   {Callback}  callback
 *
 * @summary Deletes a user from the system
 */
utils.delete_user = function (username, callback) {
  // Check if user exists
  var command = os_utils.grep_user_from_list_command(username);
  utils.execute_command(command, executed_query);

  function executed_query (err, data) {
    if (data) {
      // user exists
      command = os_utils.delete_user_command(username);
      return utils.execute_command(command, executed_deletion);
    } else {
      // user doesn't exist
      return callback();
    }
  }

  function executed_deletion (err) {
    if (err) return callback(err);
    return callback();
  }
}

/**
 * @param   {String}    username
 * @param   {Callback}  callback
 *
 * @summary Deletes the sudoers.d file of username
 */
utils.delete_sudoers_file = function (username, callback) {
  var command = 'rm /etc/sudoers.d/50_' + username + '_switcher';
  utils.execute_command(command, executed);

  function executed (err) {
    return callback();
  }
}

/**
 * @param   {String}    username
 * @param   {Callback}  callback
 *
 * @summary Gets the id of an user by username
 */
utils.get_test_user_id = function (username, callback) {
  var command = os_utils.get_test_user_id_command(username);
  utils.execute_command(command, executed);

  function executed (err, data) {
    if (err) return callback(err);
    switch(os_name) {
      case ('mac'):
        return callback(null, parseInt(data.split(' ')[1].replace('\n', '')));
        break;
      case ('linux'):
        return callback(null, parseInt(data.replace('\n', '')));
        break;
    }
  }
}

/**
 * @param   {String}    username
 * @param   {Callback}  callback
 *
 * @summary Gets the username of a user different from the test user.
 */
utils.get_existing_user = function (username, callback) {
  var test_user_id;

  utils.get_test_user_id(username, got_id);

  function got_id (err, id) {
    if (err) return callback(err);
    test_user_id = id;
    var command = os_utils.get_existing_user_command(username);
    utils.execute_command(command, executed);
  }

  function executed (err, data) {
    if (err) return callback(err);
    return callback(null, {
      id                : test_user_id,
      existing_username : data.replace('\n', '')
    });
  }
}

/**
 * @param   {String} username
 *
 * @summary  Returns the expected sudo line for `username`
 */
utils.get_expected_sudo_line = function (username, callback) {
  var command = 'which su',
      sudo_args;
  utils.execute_command(command, executed_which_su);

  function executed_which_su (err, response) {
    if (err) return callback(err);
    var which_su   = response.replace('\n', '');
    sudo_args      = which_su +' [A-z]*, !'
                   + which_su +' root*, !' + which_su +' -*\n';
    // If we are in linux, we need to check for dmidecode and iwlist
    if (os_name === 'linux') {
      command = 'which dmidecode';
      return utils.execute_command(command, executed_which_dmidecode);
    } else {
      return sendResponse(sudo_args);
    }
  }

  function executed_which_dmidecode (err, response) {
    if (response) {
      sudo_args = response.replace('\n', '') + ', ' + sudo_args;
    }
    command = 'which iwlist';
    utils.execute_command(command, executed_which_iwlist);
  }

  function executed_which_iwlist (err, response) {
    if (response) {
      sudo_args = response.replace('\n', '') + ', ' + sudo_args;
    }
    return sendResponse(sudo_args);
  }

  function sendResponse (sudo_args) {
    var line = username + ' ALL = NOPASSWD: ' + sudo_args;
    return callback(null, line);
  }
}
