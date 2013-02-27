/**
 *  TEST LIBRARY
 *
 *  Prey Client
 *
 *  Generic
 *
 */

// Module requirements
var execProcess  = require('child_process').exec
  , fs           = require('fs')
  , path         = require('path')
  , spawnProcess = require('child_process').spawn;

// Module constructor
var utils = module.exports = function () {};

/**
 * @param   {Object}  process
 *
 * @summary Stores mocha commander arguments, and deletes them
 *          must be done previous any test, since prey client
 *          relies on visionmedia's commander also
 */
utils.getMochaArgv = function (process) {
  var mochaProcessArgv  = process.argv;
  process.argv          = mochaProcessArgv.splice(0,2);

  return { process          : process
         , mochaProcessArgv : mochaProcessArgv };
}

/**
 * @param   {Object}    objVars
 * @param   {String}    username
 * @param   {Callback}  callback
 *
 * @summary Prepare environment for `create_user` tests
 */
utils.prepareTestEnvScriptCreateUser = function (objVars, callback) {
  // Does the test directory exists?
  fs.stat('/tmp/' + objVars.testDir, foundDir);

  function foundDir (err, data) {
    if (data) {
      // delete the dir
      var command = 'rm -rf /tmp/' + objVars.testDir;
      return utils.executeCommand(command, executedDeleteDir);
    }
    return queryForExistingUser();
  }

  function executedDeleteDir (err) {
    if (err) throw err;
    queryForExistingUser();
  }

  function queryForExistingUser () {
    // Does the user `username` exists
    var execCommand = 'dscl . -read /Users/' + objVars.username;
    utils.executeCommand(execCommand, executedQueryCommand);
  }

  function executedQueryCommand (err, response) {
    if (response) {
      var execCommand = 'dscl . -delete /Users/' + objVars.username;
      return utils.executeCommand(execCommand, executedDeleteUser);
    }
    return utils.checkForSudoPrivileges(objVars.username, privsChecked);
  }

  function executedDeleteUser (err) {
    if (err) throw err;
    utils.checkForSudoPrivileges(objVars.username, privsChecked);
  }

  function privsChecked (err) {
    if (err) throw err;
    // We are good to go, Prepare test directory
    return utils.generateTestDirectory(objVars.testDir, createdDir);
  }

  function createdDir (err) {
    if (err) throw err;
    // modify and copy adapted file
    utils.modifyScriptCreateUser(modifiedFile);
  }

  function modifiedFile (err, data) {
    if (err) throw err;
    if (!data) throw new Error ('Bad data!');
    fs.writeFile(objVars.dstFile, data, wroteFile);
  }

  function wroteFile (err) {
    if (err) throw err;
    fs.chmod(objVars.dstFile, '777', chmoedFile);
  }

  function chmoedFile (err) {
    if (err) throw err;
    callback();
  }
}

/**
 * @param   {String}    username
 * @param   {Callback}  callback
 *
 * @summary Check for privilege file existence.
 *          If we find the file, we delete it.
 */
utils.checkForSudoPrivileges = function (username, callback) {
  fs.stat('/etc/sudoers.d/50_prey_switcher', foundFile);

  function foundFile (err, data) {
    if (data) {
      return fs.unlink('/etc/sudoers.d/50_prey_switcher', deletedFile);
    }
    // No file, just return to the flow
    return callback();
  }

  function deletedFile (err) {
    if (err) throw err;
    return callback();
  }
}

/**
 * @param   {String}    testDir
 * @param   {String}    username
 * @param   {Callback}  callback
 *
 * @summary Cleans up directory and user for `create_user` tests
 */
utils.cleanUpScriptCreateUser = function (testDir, username, callback) {
  // Delete test user (test___prey)
  var execCommand = 'dscl . -delete /Users/' + username;
  utils.executeCommand(execCommand, executedDeleteUser);

  function executedDeleteUser (err) {
    if (err) throw err;
    // Delete working test directory
    var command = 'rm -rf /tmp/' + testDir
    utils.executeCommand(command, executedDeleteDir);
  }

  function executedDeleteDir (err) {
    if (err) throw err;
    callback();
  }
}

/**
 * @param   {String}    testDir
 * @param   {Callback}  callback
 *
 * @summary Generates a test directory in /tmp
 */
utils.generateTestDirectory = function (testDir, callback) {
  var newDir = '/tmp/' + testDir;
  utils.executeCommand('rm -rf ' + newDir, removedDir);

  function removedDir (err) {
    if (err) return callback(err);
    utils.executeCommand('mkdir -p ' + newDir, createdDir);
  }

  function createdDir (err) {
    if (err) return callback(err);
    return callback();
  }
}

/**
 * @param   {String}    command
 * @param   {Callback}  callback
 *
 * @summary Encapsulates and executes a command
 */
utils.executeCommand = function (command, callback) {
  var response
    , exec      = execProcess(command, executed);

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
 * @summary Encapsulates and executes a command
 *          sends the response based on events
 *          callback must be `callback(stderr, stdout, exit {true | false})`
 */
utils.spawnCommand = function (command, args, options, callback) {
  var cmd = spawnProcess(command, args, options);

  cmd.stdout.on('data', function (data) {
    callback(null, data.toString('utf8'));
  });

  cmd.stderr.on('data', function (data) {
    callback(data.toString('utf8'));
  });

  cmd.on('exit', function (code) {
    callback(null, null, true);
  });
}

/**
 * @param   {Callback}  callback
 *
 * @summary Copies the file `scripts/create_user.hs` and modifies it
 *          for testing purposes of one single functionality
 */
utils.modifyScriptCreateUser = function (callback) {
  var filePath = path.resolve(__dirname, '../../scripts/create_user.sh')
    , index;

  fs.readFile(filePath, 'utf8', onFileRead);

  function onFileRead (err, data) {
    if (err) return callback(err);
    index = data.match('test_impersonation\n')['index'];
    data  = data.slice(0, index) + '# ' + data.slice(index);
    return callback(null, data);
  }
}

/**
 * @param   {String}    dstDir
 * @param   {Callback}  callback
 *
 * @summary Creates an executable mock `node` file
 *          which outputs the parameters used to call it
 */
utils.createMockNodeExecFile = function (dstDir, callback) {
  var fileContents = '#!/bin/bash\necho "-- ARGV: " $@\n';
  var filePath     = '/tmp/' + dstDir + '/node'
  fs.writeFile(filePath, fileContents, wroteFile);

  function wroteFile (err) {
    if (err) return callback(err);
    fs.chmod(filePath, '777', doneChmod);
  }

  function doneChmod (err) {
    if (err) return callback(err);
    return callback();
  }
}
