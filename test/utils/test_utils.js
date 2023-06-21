/**
 *  TEST LIBRARY
 *
 *  Prey Client
 *
 *  Generic Functions
 *
 */

// Module requirements
var fs        = require('fs'),
    path      = require('path'),
    osName   = process.platform === 'darwin' ? 'mac' : 'linux',
    exec      = require('child_process').exec,
    spawn     = require('child_process').spawn;

// Module variables
var utils = module.exports = function () {};

/**
 * @param   {String}    path
 * @param   {Callback}  cb
 *
 * @summary Recursively delete a directory
 */
utils.rmdir_sync_force = function (path) {
  var files, file, fileStats, i, filesLength;
  if (path[path.length - 1] !== '/') {
    path = path + '/';
  }

  files = fs.readdirSync(path);
  filesLength = files.length;

  if (filesLength) {
    for (i = 0; i < filesLength; i += 1) {
      file = files[i];

      fileStats = fs.statSync(path + file);
      if (fileStats.isFile()) {
        fs.unlinkSync(path + file);
      }
      if (fileStats.isDirectory()) {
        utils.rmdir_sync_force(path + file);
      }
    }
  }
  fs.rmdirSync(path);
}

/**
 * @param   {String}   iface
 * @summary Makes active network interface down
 */
utils.make_network_down = function (iface) {
  var iface_down = spawn('ifconfig', [iface, 'down']);
}

/**
 * @param   {String}    iface
 * @summary Makes active network interface up
 */
utils.make_network_up = function (iface) {
  var iface_up = spawn('ifconfig', [iface, 'up']);
}

/**
 * @param   {String}      username
 * @param   {Callback}    callback
 * @summary Gets the system id from a user
 */
utils.get_user_id = function (username, callback) {
  var command;

  if (osName === 'mac') {
    command = 'dscl . -read /Users/' + username + ' UniqueID'
            + ' | awk \' { print ( $(NF) ) }\'';
  } else { // linux
    command =  'id -u ' + username;
  }

  exec(command, function (error, stdout, stderr) {
    return callback(parseInt(stdout));
  });
}

/**
 * @param   {Callback}    callback
 * @summary Gets a user id from the system different than root
 */
utils.get_non_root_user_id = function (callback) {
  var command;

  if (osName === 'mac') {
    command = 'dscl . -list /Users UniqueID'
            + ' | grep -Ev "^_|daemon|nobody|root|Guest"'
            + ' | tail -1'
            + ' | awk \' { print ( $(NF) ) }\'';
  } else { // linux
    command =  'id -u $(cat /etc/passwd | grep -E "home.*bash" | tail -1 | cut -d":" -f1)';
  }

  exec(command, function (error, stdout, stderr) {
    return callback(parseInt(stdout));
  });
}

/**
 * @param   {String}      username
 * @param   {Callback}    callback
 * @summary Gets a username from the system different than root and the
 *          parametered username
 */
utils.get_another_username = function (username, callback) {
  var command;

  if (osName === 'mac') {
    command = 'dscl . -list /Users'
            + ' | grep -Ev "^_|daemon|nobody|root|Guest|' + username + '"'
            + ' | tail -1'
            + ' | awk \' { print ( $(NF-1) ) }\'';
  } else { // linux
    command =  'cat /etc/passwd'
            + ' | grep -v "^' + username + '"'
            + ' | grep -E "home.*bash" | tail -1 | cut -d":" -f1';
  }

  exec(command, function (error, stdout, stderr) {
    return callback(stdout.replace('\n', ''));
  });
}


/**
 * @param   {Callback}    callback
 * @summary Returns in the callback the number of users the system has
 */
utils.count_users_in_system = function (callback) {
  var command;

  if (osName === 'mac') {
    command = 'dscl . -list /Users'
            + ' | grep -Ev "^_|daemon|nobody|root|Guest"'
            + ' | wc -l'
            + ' | awk \' { print ( $(NF) ) }\'';
  } else { // linux
    command =  'cat /etc/passwd | grep -E "home.*bash" | wc -l | awk \' { print ( $(NF) ) }\'';
  }

  exec(command, function (error, stdout, stderr) {
    return callback(parseInt(stdout));
  });
}

/**
 * @param   {String}      username
 * @param   {Callback}    callback
 * @summary Creates a user in the system
 */
utils.create_user = function (username, callback) {
  var command,
      id;

  if (osName === 'mac') {
    // Will be needing to issue four commands in sequence:
    command = "dscl . -list /Users UniqueID | awk '{print $2}' | sort -ug | tail -1";
    exec(command, executed_first);

    function executed_first (error, stdout) {
      id = parseInt(stdout) + 1;
      command = "dscl . -create /Users/" + username;
      exec(command, executed_second);
    }

    function executed_second () {
      command = "dscl . -create /Users/" + username + " UniqueID " + id;
      exec(command, executed_third);
    }

    function executed_third () {
      command = "dscl . -create /Users/" + username + " PrimaryGroupID 80";
      return exec(command, callback);
    }
  } else { // linux
    // TODO!!!
    exec('useradd -r -M -U -G adm -s /bin/bash ' + username, function () {
      return callback();
    });
  }
}

/**
 * @param   {String}      username
 * @param   {Callback}    callback
 * @summary Removes a user in the system
 */
utils.remove_user = function (username, callback) {
  var command;

  if (osName === 'mac') {
    command = 'dscl . -delete /Users/' + username;
    var t = setTimeout(function(){ execute_command(); }, 2000);
  } else { // linux
    command =  'userdel ' + username;
    return execute_command();
  }

  function execute_command () {
    exec(command, function (error, stdout, stderr) {
      return callback();
    });
  }
}
