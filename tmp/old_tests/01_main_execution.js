/**
 *  TEST
 *
 *  Prey Client
 *
 *  01 - Main / Execution
 *
 */

// Module Requirements
var path      = require('path')
  , should    = require('should')
  , testUtils = require('./lib/test_utils');

// Test Variables
var mochaProcessArgv;

/**
 * Main Suite
 */
// OSX
describe('## (OSX) Main / Execution', function (){
  describe('### `prey` executable', testsPreyExecutableOSX);
});
// Linux
describe('## (LINUX) Main / Execution', function (){
  describe('### `prey` executable', testsPreyExecutableLINUX);
});
// Windows
describe('## (WIN) Main / Execution', function (){
  describe('### `prey` executable', testsPreyExecutableWIN);
});

function testsPreyExecutableOSX () {
  /**
   * @test  What happens when bin/prey is called without params?
   *        (cli.js should be called)
   */
  it( 'Should call `cli.js` when `bin/prey` is called without parameters'
    , function (done) {
    // Prepare mock test directory
    var testDir = 'prey_exec_test';
    testUtils.generateTestDirectory(testDir, createdDir);

    function createdDir (err) {
      if (err) throw err;
      // Prepare mock `node` executable
      testUtils.createMockNodeExecFile(testDir, createdNodeMock);
    }

    function createdNodeMock (err) {
      if (err) throw err;
      // Copy `bin/prey` there
      var srcFile = path.resolve(__dirname, '../bin/prey');
      var dstFile = '/tmp/' + testDir + '/prey';
      var command = 'cp ' + srcFile + ' ' + dstFile;
      testUtils.executeCommand(command, copiedFile);
    }
    
    function copiedFile (err) {
      if (err) throw err;
      // Execute it...
      var execPath = '/tmp/' + testDir + '/prey';
      testUtils.executeCommand(execPath, executedCommand);
    }

    function executedCommand (err, response) {
      if (err) throw err;
      // ... And check the stdout
      // `../lib/agent/cli.js` should be called by `./bin/prey` here
      response
        .should.equal('-- ARGV:  /tmp/' + testDir + '/../lib/agent/cli.js\n');
      // No exception? cool. Let's clean up
      cleanUp();
    }

    function cleanUp () {
      var command = 'rm -rf /tmp/' + testDir
      testUtils.executeCommand(command, function (err) {
        if (err) throw err;
        return done();
      });
    }
  });
}

// TODO
function testsPreyExecutableLINUX () {
  it ('Should have a test here', function () {
    throw "Nothing implemented for Linux Yet :-(";
  });
}

// TODO
function testsPreyExecutableWIN () {
  it ('Should have a test here', function () {
    throw "Nothing implemented for Windows Yet :-(";
  });
}
