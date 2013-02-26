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
 * @param   {String}    testingFunction
 * @param   {Callback}  callback
 *
 * @summary Copies the file `scripts/create_user.hs` and modifies it
 *          for testing purposes of one single functionality
 */
utils.modifyScriptCreateUser = function (testingFunction, callback) {
  var filePath = path.resolve(__dirname, '../../scripts/create_user.sh')
    , functionalities = [ 'create_user'
                        , 'grant_privileges'
                        , 'test_impersonation' ]
    , index;

  fs.readFile(filePath, 'utf8', onFileRead);

  function onFileRead (err, data) {
    if (err) return callback(err);
    // Start the mods: Comment all function calls except the testee
    functionalities.splice(functionalities.indexOf(testingFunction), 1);
    functionalities.forEach(function (f) {
      index = data.match(f + '\n')['index'];
      data = data.slice(0, index) + '# ' + data.slice(index);
    });

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
