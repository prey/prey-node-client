/**
 *  TEST
 *
 *  Prey Client
 *
 *  OSX
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
describe('# __HERMAN__ (OSX) Installation', function () {
  describe('## scripts/create_user.sh', suiteScriptsCreateUser);
});

function suiteScriptsCreateUser () {
  // Suite Variables
  var testDir   = 'prey_exec_test'
    , dstFile   = path.resolve('/tmp', testDir, 'create_user.sh')
    , username  = 'test___prey';

  before(function (done) {
    var objVars = {
      testDir     : testDir
    , dstFile     : dstFile
    , username    : username
    }
    testUtils.prepareTestEnvScriptCreateUser(objVars, done);
  });

  describe('###create_user()', function () {
    // ### create_user() suite variables
    var execPath = dstFile;

    it('Should exit when no username is given', function (done) {
      var execCommand = execPath;
      testUtils.executeCommand(execCommand, executedCreationCommand);

      function executedCreationCommand (err, response) {
        err.should.be.equal('User name required.\n');
        done();
      }
    });

    it('Should create a user, given the username', function (done) {
      this.timeout(4000);
      var execCommand = execPath + ' ' + username;
      testUtils.executeCommand(execCommand, executedCreationCommand);

      function executedCreationCommand (err, response) {
        if (err) throw err;
        // Let's test if the user was created
        execCommand = 'dscl . -read /Users/' + username;
        testUtils.executeCommand(execCommand, executedQueryCommand);
      }

      function executedQueryCommand (err, response) {
        // If the user was not created, we will have an error
        if (err) throw err;
        // Let's check the rest of the values:
        var userData = response.split('\n');
        assert(userData.indexOf('UserShell: /bin/bash') !== -1, 'UserShell should be /bin/bash');
        var indexRealName = userData.indexOf('RealName:');
        userData[indexRealName + 1].should.be.equal(' Prey Anti-Theft');
        assert(userData.indexOf('PrimaryGroupID: 80') !== -1, 'PrimaryGroupID should be 80');
        assert(userData.indexOf('Password: *') !== -1, 'Password should be *');
        done();
      }
    });

    it('Should exit if it is executed with a user different than root', function (done) {
      var execCommand       = 'dscl . -read /Users/' + username + ' | grep UniqueID'
        , creationResponse  = ''
        , expectedText      = '/tmp/' + testDir + '/create_user.sh must be run as root.\n';

      testUtils.executeCommand(execCommand, executedQueryCommand);

      function executedQueryCommand (err, response) {
        if (err) throw err;
        var id = parseInt(response.split(' ')[1].replace('\n', ''));
        testUtils.spawnCommand( execPath
                              , [username]
                              , {uid : id}
                              , executedCreationCommand);
      }

      function executedCreationCommand (stderr, stdout, exit) {
        if (stdout) {
          creationResponse += stdout;
        }
        if (exit) {
          creationResponse.should.be.equal(expectedText);
          done();
        }
      }
    });

    it('Should exit if user already exists', function (done) {
      var execCommand = execPath + ' ' + username;
      testUtils.executeCommand(execCommand, executedCreationCommand);

      function executedCreationCommand (err, response) {
        response.should.be.equal(username + ' user already exists!\n'),
        done();
      }
    });
  });

  describe('###grant_privileges()', function () {
    it('Should have a Test here', function (done) {
      throw "Not implemented Yet";
    });
  });

  after(function (done) {
    testUtils.cleanUpScriptCreateUser(testDir, username, done);
  });
}
