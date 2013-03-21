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
    spawn_process = require('child_process').spawn;

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
}

/**
 * @param   {String}    username
 * @param   {Callback}  callback
 *
 * @summary Deletes a user from the system
 */
utils.delete_user = function (username, callback) {
  // Check if user exists
  var command = 'dscl . -list /Users | grep ' + username;
  utils.execute_command(command, executed_query);

  function executed_query (err, data) {
    if (data) {
      // user exists
      command = 'dscl . -delete /Users/' + username
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
  var command = 'dscl . -read /Users/' + username + ' | grep UniqueID';
  utils.execute_command(command, executed);

  function executed (err, data) {
    if (err) return callback(err);
    return callback(null, parseInt(data.split(' ')[1].replace('\n', '')));
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
    var command = 'dscl . -list /Users | '
                + 'grep -Ev "^_|daemon|nobody|root|Guest|' + username
                + '" | tail -1';
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
