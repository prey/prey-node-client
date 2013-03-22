/**
 * TEST LIBRARY
 *
 * Prey Client
 *
 * Generic Functions
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
    if (err) return callback(err);
    return queryForExistingUser();
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
    if (err) return callback(err);
    return utils.checkForSudoPrivileges(objVars.username, privsChecked);
  }

  function privsChecked (err) {
    if (err) return callback(err);
    // We are good to go, Prepare test directory
    return utils.generateTestDirectory(objVars.testDir, createdDir);
  }

  function createdDir (err) {
    if (err) return callback(err);
    // modify and copy adapted file
    return utils.modifyScriptCreateUser(objVars.username, modifiedFile);
  }

  function modifiedFile (err, data) {
    if (err) return callback(err);
    if (!data) return callback(new Error ('Bad data!'));
    return fs.writeFile(objVars.dstFile, data, wroteFile);
  }

  function wroteFile (err) {
    if (err) return callback(err);
    return fs.chmod(objVars.dstFile, '777', chmoedFile);
  }

  function chmoedFile (err) {
    if (err) return callback(err);
    return callback();
  }
}

/**
 * @param   {Object}    objVars
 * @param   {Callback}  callback
 *
 * @summary Prepare environment for `bin/prey` tests
 */
utils.prepareTestEnvPreyExecutable = function (objVars, callback) {
  utils.generateTestDirectory(objVars.testDir, createdDir);

  function createdDir (err) {
    if (err) callback(err);
    utils.createMockNodeExecFile(objVars.testDir, createdNodeMock);
  }

  function createdNodeMock (err) {
    if (err) callback(err);
    var srcFile = path.resolve(__dirname, '..', '..', 'bin', 'prey');
    var dstFile = '/tmp/' + objVars.testDir + '/prey';
    var command = 'cp ' + srcFile + ' ' + dstFile;
    utils.executeCommand(command, copiedFile);
  }

  function copiedFile (err) {
    if (err) callback(err);
    callback();
  }
}

/**
 * @param   {Object}    objVars
 * @param   {Callback}  callback
 *
 * @summary Prepare environment for `./bin/prey config activate` tests
 */
utils.prepareTestEnvConfigActivate = function (objVars, callback) {
  var execCommand
    , srcPath = path.resolve(__dirname, 'configActivateTester.js')
    , dstPath = path.resolve('/tmp/' + objVars.testDir + '/configActivateTester.js');
  // Create our test client for this suite
  utils.generateTestUser(objVars.username, createdUser);

  function createdUser (err) {
    if (err) return callback(err);
    // Create the /tmp/${TEST_DIR}
    utils.generateTestDirectory(objVars.testDir, createdDir);
  }

  function createdDir (err) {
    if (err) return callback(err);
    // Copy test script dependencies
    var command = path.resolve(__dirname, 'configActivateEnv.sh');
    var srcPath = path.resolve(__dirname, '..', '..');
    var dstPath = '/tmp/' + objVars.testDir;
    execCommand = command + ' ' + srcPath + ' ' + dstPath;
    utils.executeCommand(execCommand, copiedTestScriptDependencies);
  }

  function copiedTestScriptDependencies (err) {
    if (err) return callback(err);
    // Give Ownership of the directory to the test user
    execCommand = 'chown -R ' + objVars.username + ' '
                + '/tmp/' + path.resolve(objVars.testDir, '..', '..');
    utils.executeCommand(execCommand, gaveOwnership);
  }

  function gaveOwnership (err) {
    if (err) return callback(err);
    return callback();
  }
}

/**
 * @param   {Object}    objVars
 * @param   {Callback}  callback
 *
 * @summary Prepare environment for `./bin/prey config activate` tests
 *          with a new version. Which is actually a copy, but with
 *          a different version number writter
 */
utils.prepareTestEnvConfigActivateCopy = function (objVars, callback) {
  // Install "another version" (is the same, but we will change the version number)
  var packageJsonPath
    , newVersion = objVars.version.split('.');
  newVersion[2] = parseInt(newVersion[2]) + 1;
  newVersion = newVersion.join('.');
  var testDir   = path.resolve('/', 'test_prey', 'versions', newVersion)
    , testPath  = '/tmp' + testDir

  // If everything goes OK, we'll be needing this object
  var response = { testPath   : testPath
                 , newVersion : newVersion
  }

  // Create directory...
  var execCommand = 'mkdir ' + testPath;
  utils.executeCommand(execCommand, createdDir);

  function createdDir (err) {
    if (err) return callback(err);
    // Copy test script dependencies
    var command = path.resolve(__dirname, 'configActivateEnv.sh');
    var srcPath = path.resolve(__dirname, '..', '..');
    execCommand = command + ' ' + srcPath + ' ' + testPath;
    utils.executeCommand(execCommand, copiedTestScriptDependencies);
  }

  function copiedTestScriptDependencies (err) {
    if (err) return callback(err);
    // Modify the version of this package.json
    packageJsonPath = path.resolve(testPath, 'package.json');
    fs.readFile(packageJsonPath, 'utf8', readFile);
  }

  function readFile (err, data) {
    if (err) return callback(err);
    var packageJSON = JSON.parse(data);
    packageJSON.version = newVersion;
    var newContent = JSON.stringify(packageJSON, null, 2);
    fs.writeFile(packageJsonPath, newContent, modifiedFile);
  }

  function modifiedFile (err) {
    if (err) return callback(err);
    // Don't forget to change the ownership!
    execCommand = 'chown -R ' + objVars.username + ' ' + testPath;
    utils.executeCommand(execCommand, gaveOwnership);
  }

  function gaveOwnership (err) {
    if (err) return callback(err);
    return callback(null, response);
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
  fs.stat('/etc/sudoers.d/50_' + username + '_switcher', foundFile);

  function foundFile (err, data) {
    if (data) {
      return fs.unlink( '/etc/sudoers.d/50_' + username
                      + '_switcher', deletedFile);
    }
    // No file, just return to the flow
    return callback();
  }

  function deletedFile (err) {
    if (err) return callback(err);
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
    if (err) return callback(err);
    // Delete working test directory
    var command = 'rm -rf /tmp/' + testDir;
    return utils.executeCommand(command, executedDeleteDir);
  }

  function executedDeleteDir (err) {
    if (err) return callback(err);
    return callback();
  }
}

/**
 * @param   {String}    testDir
 * @param   {Callback}  callback
 *
 * @summary Cleans up directory for `bin/prey` tests
 */
utils.cleanUpEnvPreyExecutable = function (testDir, callback) {
  var command = 'rm -rf /tmp/' + testDir;
  utils.executeCommand(command, executedDeleteDir);

  function executedDeleteDir (err) {
    if (err) return callback(err);
    return callback();
  }
}

/**
 * @param   {String}    username
 * @param   {String}    testDir
 * @param   {Callback}  callback
 *
 * @summary Cleanup environment for `./bin/prey config activate` tests
 */
utils.cleanUpTestEnvConfigActivate = function (username, testDir, callback) {
  // Delete user
  var execCommand = 'dscl . -delete /Users/' + username;
  utils.executeCommand(execCommand, deletedUser);

  function deletedUser (err) {
    if (err) return callback(err);
    // Delete directory
    var testPath = path.resolve(/tmp/ + testDir + '/../../');
    execCommand = 'rm -rf ' + testPath;
    utils.executeCommand(execCommand, deletedDir);
  }

  function deletedDir (err) {
    if (err) return callback(err);
    return callback();
  }
}

/**
 * @param   {String}    username
 * @param   {Callback}  callback
 *
 * @summary Generates a test user
 */
utils.generateTestUser= function (username, callback) {
  // Check whether this username exists
  var execCommand = 'dscl . -read /Users/' + username
    , id;
  utils.executeCommand(execCommand, gotUser);

  function gotUser (err, data) {
    // No error handler: If we got `err` that means there
    // is no user with that handle
    if (data) {
      // We got the user, move on
      return callback();
    }
    // Get id
    execCommand = "dscl . -list /Users UniqueID | awk '{print $2}' | sort -ug | tail -1";
    utils.executeCommand(execCommand, gotId);
  }

  function gotId (err, _id) {
    if (err) return callback(err);
    id = parseInt(_id) + 1;
    // Create the user
    execCommand = "dscl . -create /Users/" + username;
    utils.executeCommand(execCommand, createdUser);
  }

  function createdUser (err) {
    if (err) return callback(err);
    // Assign the id to the user
    execCommand = "dscl . -create /Users/" + username + " UniqueID " + id;
    utils.executeCommand(execCommand, assignedUniqueID);
  }

  function assignedUniqueID (err) {
    if (err) return callback(err);
    execCommand = "dscl . -create /Users/" + username + " PrimaryGroupID 80";
    utils.executeCommand(execCommand, assignedPrimaryGroupID);
  }

  function assignedPrimaryGroupID (err) {
    if (err) return callback(err);
    return callback();
  }
}

/**
 * @param   {String}    testDir
 * @param   {Callback}  callback
 *
 * @summary Generates a test directory in /tmp
 */
utils.generateTestDirectory = function (testDir, callback) {
  var newPath = '/tmp/' + testDir
    , newDir  = path.resolve(newPath);
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
  // Foolproof checks
  if (command.match(/rm -rf/)) {
    // `rm -rf ...`
    var basePath = command.split(' ')[2].split('/');
    if (basePath[1] !== 'tmp' || basePath[2] !== 'test_prey')
      return callback('Forbidden command: ' + command);
  } else if (command.match(/dscl . -delete/)) {
    // `dscl . -delete /Users/...`
    var userPath = command.split(' ')[3].split('/')
    if (userPath[1] !== 'Users' || userPath[2] !== 'test___prey')
      return callback('Forbidden command: ' + command);
  }

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
 * @param   {String}    username
 * @param   {Callback}  callback
 *
 * @summary Copies the file `scripts/create_user.hs` and modifies it
 *          for testing purposes of one single functionality
 */
utils.modifyScriptCreateUser = function (username, callback) {
  var filePath = path.resolve(__dirname, '../../scripts/create_user.sh')
    , index;

  fs.readFile(filePath, 'utf8', onFileRead);

  function onFileRead (err, data) {
    if (err) return callback(err);
    // Change sudoers filePath
    //data.replace( 'SUDOERS_FILE="/etc/sudoers.d/50_prey_switcher"'
    //            , 'SUDOERS_FILE="/etc/sudoers.d/50_' + username + '_switcher"');
    data = data.replace( 'SUDOERS_FILE="/etc/sudoers.d/50_prey_switcher"'
                       , 'SUDOERS_FILE="/etc/sudoers.d/50_' + username + '_switcher"');
    // Comment `test_impersonation` function
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
