/**
 *  TEST
 *
 *  Prey Client
 *
 *  00 - Installation
 *
 */

// Module Requirements
var assert    = require('assert')
  , fs        = require('fs')
  , should    = require('should')
  , path      = require('path')
  , testUtils = require('./lib/test_utils');

/**
 * Main Suite
 */
// OSX
describe('## __HERMAN__ (OSX) Installation', function (){
  describe('### `scripts/create_user.sh`', testsPreyInstallationOSX);
});
// Linux
describe('## (LINUX) Installation', function (){
  describe('### `scripts/create_user.sh`', testsPreyInstallationLINUX);
});
// Windows
describe('## (WIN) Installation', function (){
  describe('### `scripts/create_user.sh`', testsPreyInstallationWIN);
});

// TODO
function testsPreyInstallationOSX () {
  it ('Should create a user', function (done) {
    this.timeout(4000)
    // Prepare test directory
    var testDir = 'prey_exec_test'
      , dstFile = path.resolve('/tmp', testDir, 'create_user.sh');
    testUtils.generateTestDirectory(testDir, createdDir);

    function createdDir (err) {
      if (err) throw err;
      // modify and copy adapted file
      testUtils.modifyScriptCreateUser('create_user', modifiedFile);
    }

    function modifiedFile (err, data) {
      if (err) throw err;
      if (!data) throw new Error ('Bad data!');
      fs.writeFile(dstFile, data, wroteFile);
    }

    function wroteFile (err) {
      if (err) throw err;
      fs.chmod(dstFile, '777', chmoedFile);
    }

    function chmoedFile (err) {
      if (err) throw err;
      var execPath = dstFile;
      var execCommand = execPath + ' test___prey';
      testUtils.executeCommand(execCommand, executedCreationCommand);
    }

    function executedCreationCommand (err, response) {
      if (err) throw err;
      // Let's test if the user was created
      var execCommand = 'dscl . -read /Users/test___prey'
      testUtils.executeCommand(execCommand, executedQueryCommand);
    }

    function executedQueryCommand (err, response) {
      // If the user is not created, we will have an error
      if (err) throw err;
      // Let's check the rest of the values:
      var userData = response.split('\n');
      assert(userData.indexOf('UserShell: /bin/bash') !== -1, 'UserShell should be /bin/bash');
      var indexRealName = userData.indexOf('RealName:');
      userData[indexRealName + 1].should.be.equal(' Prey Anti-Theft');
      assert(userData.indexOf('PrimaryGroupID: 80') !== -1, 'PrimaryGroupID should be 80');
      assert(userData.indexOf('Password: *') !== -1, 'Password should be *');

      // No errors? Cool, let's clean up
      cleanUp();
    }

    ///
    // CLEANUP
    function cleanUp () {
      // Delete user created
      var execCommand = 'dscl . -delete /Users/test___prey'
      testUtils.executeCommand(execCommand, executedDeleteCommand);
    }

    function executedDeleteCommand (err) {
      if (err) throw err;
      // Delete working test directory
      var command = 'rm -rf /tmp/' + testDir
      testUtils.executeCommand(command, function (err) {
        if (err) throw err;
        return done();
      });
    }
  });
}

// TODO
function testsPreyInstallationLINUX () {
  it ('Should have a test here', function () {
    throw "Nothing implemented for Linux Yet :-(";
  });
}

// TODO
function testsPreyInstallationWIN () {
  it ('Should have a test here', function () {
    throw "Nothing implemented for Windows Yet :-(";
  });
}