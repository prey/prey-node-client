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
describe('# (OSX) Installation', function () {
  describe('## scripts/create_user.sh', suiteScriptsCreateUser);
  describe('## prey config activate',   suiteConfigActivate);
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
      this.timeout(10000);
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
        assert(response.toString().indexOf('AuthenticationAuthority:') === -1, 'AuthenticationAuthority exists!');
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
    // Suite variables
    var execCommand   = 'dscl . -read /Users/' + username
                      + ' | grep UniqueID'
      , existingUser
      , id
      , sudoersPath   = '/etc/sudoers.d/50_' + username +'_switcher';

    it('Should find the sudoers.d file and that it has the right privileges', function (done) {
      var privilegesText  =
          username
        + ' ALL = NOPASSWD: /usr/bin/su [A-z]*, !/usr/bin/su root*, !/usr/bin/su -*\n';
      fs.stat(sudoersPath, foundFile);

      function foundFile (err) {
        if (err) throw err;
        fs.readFile(sudoersPath, 'utf8', readFile);
      }

      function readFile (err, data) {
        if (err) throw err;
        assert( data === privilegesText
              , 'sudoers file text should be `' + privilegesText + '` and is `' + data + '`');
        done();
      }
    });

    it('Should, as <username>, impersonate the existing user', function (done) {
      var impersonateResponse = '';

      testUtils.executeCommand(execCommand, executedQueryIDCommand);

      function executedQueryIDCommand (err, response) {
        if (err) throw err;
        id = parseInt(response.split(' ')[1].replace('\n', ''));
        execCommand = 'dscl . -list /Users | '
                    + 'grep -Ev "^_|daemon|nobody|root|Guest|' + username
                    + '" | tail -1';
        testUtils.executeCommand(execCommand, executedQueryExistingCommand);
      }

      function executedQueryExistingCommand (err, response) {
        if (err) throw err;
        existingUser = response.replace('\n', '');
        testUtils.spawnCommand( 'sudo'
                      , ['-n', 'su', existingUser, '-c', 'whoami']
                      , {uid : id}
                      , executedImpersonateCommand);
      }

      function executedImpersonateCommand (stderr, stdout, exit) {
        if (stdout) {
          impersonateResponse += stdout;
        }
        if (exit) {
          impersonateResponse.should.be.equal(existingUser + '\n');
          // Reset cached credentials
          testUtils.spawnCommand('sudo', ['-k'], {}, executedCleanUp);
        }
      }

      function executedCleanUp (stderr, stdout, exit) {
        if (stderr) {
          impersonateResponse += stderr;
        }
        if (stdout) {
          impersonateResponse += stdout;
        }
        if (exit) {
          done();
        }
      }
    });

    it('Should, as <username>, be unable to '
      +'impersonate if the sudoers file doesn\'t exist', function (done) {
      var impersonateResponse = '';

      // Delete this file...
      fs.unlink(sudoersPath, deletedFile)

      // ... Try to impersonate
      function deletedFile (err) {
        if (err) throw err;
        testUtils.spawnCommand( 'sudo'
                      , ['-n', 'su', existingUser, '-c', 'whoami']
                      , {uid : id}
                      , executedImpersonateCommand);
      }

      function executedImpersonateCommand (stderr, stdout, exit) {
        if (stderr) {
          impersonateResponse += stderr;
        }
        if (stdout) {
          impersonateResponse += stdout;
        }
        if (exit) {
          var expectedText = "sudo: sorry, a password is required to run sudo\n";
          impersonateResponse.should.be.equal(expectedText);
          done();
        }
      }
    });
  });

  after(function (done) {
    testUtils.cleanUpScriptCreateUser(testDir, username, doneCleanup);
    function doneCleanup (err) {
      if (err) throw err;
      done();
    }
  });
}

function suiteConfigActivate () {
  describe('### Execution', function () {
    // Suite vars
    var testDir = 'prey_exec_test';

    before(function (done) {
      var objVars = {
        testDir     : testDir
      }
      testUtils.prepareTestEnvPreyExecutable(objVars, createdEnv);

      function createdEnv (err) {
        if (err) throw err;
        done();
      }
    });

    it('Should load `lib/conf/cli.js` on `config activate` command', function (done) {
      var execCommand = '/tmp/' + testDir + '/prey' + ' config activate';
      testUtils.executeCommand(execCommand, executedCommand);

      function executedCommand (err, response) {
        var expectedResponse = '-- ARGV:  /tmp/'
                             + testDir
                             + '/../lib/conf/cli.js'
                             + ' config activate'
                             + '\n'
        response.should.equal(expectedResponse);
        done();
      }
    });

    after(function (done) {
      testUtils.cleanUpEnvPreyExecutable(testDir, doneCleanup);
      function doneCleanup (err) {
        if (err) throw err;
        done();
      }
    });
  });

  // TODO: For now, we are copying the whole directory
  describe('#### set_up_version()', function () {
    // Suite vars
    var testDir = 'prey_conf_lib_test';

    before(function (done) {
      var objVars = {
        testDir     : testDir
      }
      testUtils.prepareTestSetVersion(objVars, createdEnv);

      function createdEnv (err) {
        if (err) throw err;
        done();
      }
    });

    it('Should not do anything if `process.env.BUNDLE_ONLY is on`', function (done) {
      // Modify the file `cli.js` to output a message
      // if it leaves after encountering `process.env.BUNDLE_ONLY`

      // Modify process.argv & process.exit

      // Prepare the other dependencies to be injected

      // Load the module using dependecy injection


      // The real test: Compare the outputs


      // Cleanup: Modify `cli.js`



      throw "Not Implemented";
    });

    after(function (done) {
      testUtils.cleanupTestSetVersion(testDir, done);
    });
  });
}
