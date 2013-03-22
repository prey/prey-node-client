/**
 * TEST
 *
 * Prey Client
 *
 * OSX
 *
 * 00 - Installation
 *
 */

// Module Requirements
var assert    = require('assert')
  , fs        = require('fs')
  , should    = require('should')
  , path      = require('path')
  , sandbox   = require('sandboxed-module')
  , testUtils = require('./lib/test_utils');

/**
 * Main Suite
 */
describe('# (OSX) Installation', function () {
  describe('## prey config activate',     suiteConfigActivate);
  describe('## prey config hooks',        suiteConfigHooks);
});

function suiteConfigActivate () {
  describe('### Execution', function () {
    // Suite vars
    var testDir = 'test_prey';

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
                             + '\n';
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

  describe('### Controller', function () {
    // Suite variables
    var id
      , version   = require(path.resolve(__dirname, '..','package.json')).version
      , testDir   = path.resolve('/', 'test_prey', 'versions', version)
      , testPath  = '/tmp/' + testDir
      , username  = 'test___prey';

    before(function (done) {
      this.timeout(10000);
      var objVars = {
        testDir     : testDir
      , username    : username
      }
      testUtils.prepareTestEnvConfigActivate(objVars, preparedEnv);

      function preparedEnv (err) {
        if (err) throw err;
        done();
      }
    });

    it('Should not do anything if `process.env.BUNDLE_ONLY is on`', function (done) {
      // Environment
      var myStdOutMessages = new Array();
      var log = function (msg) {
        myStdOutMessages.push(msg);
      }
      // Key variable
      process.env.BUNDLE_ONLY = true;
      // Require the controller and call the function
      var cli_controller = require('../lib/conf/cli_controller')(log, onActivateCalled);
      cli_controller.activate();

      function onActivateCalled (err, msg) {
        if (err) myStdOutMessages.push('ERR: ' + err.message);
        if (msg) myStdOutMessages.push('MSG: ' + msg);
        if (arguments.length === 0) myStdOutMessages.push('OK');
        // The test
        myStdOutMessages.should.have.length(1);
        myStdOutMessages[0].should.be.equal('OK');

        // Are we done yet? Let's clean the variable
        delete process.env.BUNDLE_ONLY;
        done();
      }
    });

    it('Should setup version and interval on `controller#activate` call`', function (done) {
      var execCommand       = 'dscl . -read /Users/' + username + ' | grep UniqueID'
        , creationResponse  = '';
      testUtils.executeCommand(execCommand, executedQueryCommand);

      function executedQueryCommand (err, response) {
        if (err) throw err;
        id            = parseInt(response.split(' ')[1].replace('\n', ''))
        var execPath  = testPath + '/configActivateTester.js';

        testUtils.spawnCommand( execPath
                      , []
                      , { cwd : testPath
                        , uid : id
                        }
                      , executedActivateCommand);
      }

      function executedActivateCommand (stderr, stdout, exit) {
        if (stderr) {
          creationResponse += stderr;
        }
        if (stdout) {
          creationResponse += stdout;
        }
        if (exit) {
          // Let's make sure we end the operation without problems
          var response = creationResponse.split('\n');
          response[response.length - 2].should.be.equal('END - OK');

          // We need to know whether we made a prey.conf file and sync'ed it
          // So, we are checking the output messages
          response[0].should.be.equal('MSG: Ensuring presence of config dir:'
                                     +' /private/tmp/test_prey/test_conf');
          var expectedMessage = 'MSG: Syncing config with /private/tmp/test_prey/versions/'
                              + version + '/prey.conf.default';
          response[1].should.be.equal(expectedMessage);
          response[2].should.be.equal('MSG: Setting up this as current...');
          // And, we will have this error, since we haven't symlinked yet
          response[3].should.be.equal('Cannot find module \'/private/tmp'
                                     +'/test_prey/current/package.json\'');

          // Now, let's verify whether we have the prey.conf file
          var filePath = '/tmp/test_prey/test_conf/prey.conf'
          fs.readFile(filePath, 'utf8', foundFile);
        }
      }

      function foundFile (err, data) {
        if (err) throw err;
        if (!data || data.length === 0) throw new Error ('`prey.conf` file is empty!');
        if (!data.match(/\n# Prey configuration file/)) throw new Error ('Bad configuration file');
        // We also need to know whether we have made our cron line
        creationResponse = '';
        testUtils.spawnCommand('crontab'
              , ['-l']
              , { cwd : testPath
                , uid : id
                }
              , gotResponse);
      }

      function gotResponse (stderr, stdout, exit) {
        if (stderr) {
          creationResponse += stderr;
        }
        if (stdout) {
          creationResponse += stdout;
        }
        if (exit) {
          // Test
          var expectedMessage = '31 * * * * /private/tmp/test_prey/current/bin/prey\n';
          creationResponse.should.be.equal(expectedMessage);
          done();
        }
      }
    });

    it('Should `install` a new version, and update the system', function (done) {
      // NOTE: For this test to work, we need the above test to work also.
      // Now that we now that, let's prepare the environment
      var creationResponse
        , newVersion
        , objVars = { version   : version
                    , username  : username
                    }
      testUtils.prepareTestEnvConfigActivateCopy(objVars, preparedEnv);

      function preparedEnv (err, response) {
        if (err) throw err;
        newVersion = response.newVersion;
        var execPath  = response.testPath + '/configActivateTester.js';

        // Reset this!
        creationResponse = '';
        // And call the command as <username>
        testUtils.spawnCommand( execPath
                      , []
                      , { cwd : response.testPath
                        , uid : id
                        }
                      , executedActivateCommand);
      }

      function executedActivateCommand (stderr, stdout, exit) {
        if (stderr) {
          creationResponse += stderr;
        }
        if (stdout) {
          creationResponse += stdout;
        }
        if (exit) {
          // TEST: Since we have as assumption, that the above test is correct
          //       we will just check whether the current symlink points to this
          //       new version

          // Let's check anyways the output messages
          var response = creationResponse.split('\n');
          response[response.length - 2].should.be.equal('END - OK');
          response[0].should.be.equal('MSG: Ensuring presence of config dir:'
                                     +' /private/tmp/test_prey/test_conf');
          var expectedMessage = 'MSG: Syncing config with /private/tmp/test_prey/versions/'
                              + newVersion + '/prey.conf.default';
          response[1].should.be.equal(expectedMessage);
          response[2].should.be.equal('MSG: Setting up this as current...');

          // NOTE: See we don't have the error that we had above, since we have
          //       a `current` symlink from the "former" version

          // Now we check explicitly the status of the symlink
          var execPath = 'ls -al /tmp/test_prey/current';
          testUtils.executeCommand(execPath, madeQuery);
        }
      }

      function madeQuery (err, output) {
        if (err) throw err;
        var data = output.split('/');
        var currentVersion = data[data.length - 1].replace('\n', '');
        // The test...
        currentVersion.should.be.equal(newVersion);
        done();
      }
    });

    it('Should go to `controller#show_gui_and_exit` when -g flag is called', function (done) {
      var execPath        = testPath + '/configActivateTester.js'
        , commandResponse = '';
      testUtils.spawnCommand( execPath
                              , ['-g']
                              , { uid : id
                                , cwd : testPath
                              }
                              , executedCommand);

      function executedCommand (stderr, stdout, exit) {
        if (stderr) {
          commandResponse += stderr;
        }
        if (stdout) {
          commandResponse += stdout;
        }
        if (exit) {
          // TEST
          var response = commandResponse.split('\n');
          response[response.length - 5].should.be.equal('MSG: helpers.run_detached called');
          response[response.length - 4].should.be.equal('MSG: gui_path - /usr/bin/ruby');
          assert( response[response.length - 3]
                    .match(/PreyConfig.app\/Contents\/MacOS\/prey-config.rb/) !== null
                , "Argument of gui should be PreyConfig.app/Contents/MacOS/prey-config.rb");
          response[response.length - 2].should.be.equal('MSG: Exiting...');
          done();
        }
      }
    });

    after(function (done) {
      testUtils.cleanUpTestEnvConfigActivate(username, testDir, cleanedUp);

      function cleanedUp (err) {
        if (err) throw err;
        done();
      }
    });
  });
}

function suiteConfigHooks () {
  // Suite Variables
  var launchdaemons_path = '/tmp/test_prey'
    , launchd_plist      = 'com.prey.trigger.plist'

  before(function (done) {
    var execCommand = 'rm -rf /tmp/test_prey';
    testUtils.executeCommand(execCommand, deletedDir);
    function deletedDir (err) {
      if (err) throw err;
      fs.mkdir('/tmp/test_prey', done);
    }
  });

  it('Should set up `prey-trigger.py` in launchd', function (done) {
    this.timeout(10000);
    // Test dependencies
    var system          = require('../lib/system')
      , common          = require('../lib/common')
      , hook_locals     = {
          running_user        : 'test___prey'
        , label               : 'com.test_prey.trigger'
        , launchdaemons_path  : launchdaemons_path
        , launchd_plist       : launchd_plist
        , trigger_script      : 'prey-trigger.py'
      }
      , myConsoleOutput = []
      , myConsole       = {};
    myConsole.log       = function (msg) { myConsoleOutput.push(msg); }
    var hooks           =
      sandbox.require('../lib/conf/' + common.os_name
                     ,  { requires          : {
                            './hook_locals' : hook_locals
                          }
                        , globals           : {
                            console         : myConsole
                          }
                        });

    // Do the call!
    hooks.post_install(madeHookCall);

    function madeHookCall (err) {
      if (err) throw err;
      // TEST
      // stdout
      myConsoleOutput[0].should.be.equal('Setting up launchd script...');
      myConsoleOutput[1].should.be.equal('LaunchDaemon script copied. Loading it...');
      // Does the file exists? (if not, an exception will be raised)
      var plistData = fs.readFileSync('/tmp/test_prey/' + hook_locals.launchd_plist, 'utf8');
      // Content checking
      var trigger_script_path = path.join(system.paths.current, 'bin', 'mac', 'prey-trigger.py');
      var expectedMatch = new RegExp('<string>' + trigger_script_path + '</string>');
      if(!plistData.match(expectedMatch)) throw 'Incorrect Trigger Script in .plist file';
      expectedMatch = new RegExp('<string>' + system.paths.current_bin +'</string>');
      if(!plistData.match(expectedMatch)) throw 'Incorrect Prey binary in .plist file';
      expectedMatch = /<key>UserName<\/key>\n\t<string>test___prey<\/string>/;
      if(!plistData.match(expectedMatch)) throw 'Incorrect UserName in .plist file';
      // One thing left. Did we load the line into `launchctl`?
      var execCommand = 'launchctl list';
      testUtils.executeCommand(execCommand, onQueryResponse);
    }

    function onQueryResponse (err, data) {
      if (err) throw err;
      if(!data.match(/com.test_prey.trigger/)) throw '.plist is not loaded into system'
      done();
    }
  });

  it('Should unset up `prey-trigger.py` in launchd and delete the .plist file', function (done) {
    this.timeout(10000);
    // Test dependencies
    var system          = require('../lib/system')
      , common          = require('../lib/common')
      , hook_locals     = {
          running_user        : 'test___prey'
        , label               : 'com.test_prey.trigger'
        , launchdaemons_path  : launchdaemons_path
        , launchd_plist       : launchd_plist
        , trigger_script      : 'prey-trigger.py'
      }
      , myConsoleOutput = []
      , myConsole       = {};
    myConsole.log       = function (msg) { myConsoleOutput.push(msg); }
    var hooks           =
      sandbox.require('../lib/conf/' + common.os_name
                     ,  { requires          : {
                            './hook_locals' : hook_locals
                          }
                        , globals           : {
                            console         : myConsole
                          }
                        });

    // Do the call!
    hooks.pre_uninstall(madeHookCall);

    function madeHookCall (err) {
      if (err) throw err;
      // TEST
      // stdout
      myConsoleOutput[0].should.be.equal('Removing launchd script...');
      myConsoleOutput[1].should.be.equal('Prey trigger unloaded. Removing plist...');
      // Check if the service is still loaded
      var execCommand = 'launchctl list';
      testUtils.executeCommand(execCommand, onQueryResponse);
    }

    function onQueryResponse (err, data) {
      if (err) throw err;
      if(data.match(/com.test_prey.trigger/)) throw '.plist is not loaded into system'
      // Check that the file isn't there
      try {
        var plistData = fs.readFileSync('/tmp/test_prey/' + hook_locals.launchd_plist, 'utf8');
      } catch (e) {
        e.code.should.be.equal('ENOENT');
      }
      done();
    }
  });

  after(function (done) {
    // Unload plist
    var execCommand = 'launchctl unload ' + launchdaemons_path + '/' + launchd_plist;
    testUtils.executeCommand(execCommand, unloadedPlist);

    function unloadedPlist (err) {
      if (err) {
        if(!err.toString().match(/Error: Command failed: launchctl: Couldn't stat/))
          throw err;
      }
      execCommand = 'rm -rf /tmp/test_prey';
      testUtils.executeCommand(execCommand, deletedDir);
    }

    function deletedDir (err) {
      if (err) throw err;
      done();
    }
  });
}
