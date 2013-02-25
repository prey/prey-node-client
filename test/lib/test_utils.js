
// Module requirements
var fs           = require('fs')
  , execProcess  = require('child_process').exec;

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
 *          sends the response on Exit or Error
 */
utils.executeCommand = function (command, callback) {
  var response
    , exec      = execProcess(command, executed);

  function executed (error, stdout, stderr) {
    if (error !== null) return callback(error);
    if (stderr !== '') return callback(stderr);
    return callback(null, stdout);
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
