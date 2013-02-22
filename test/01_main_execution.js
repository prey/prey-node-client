/**
 *  TEST
 *
 *  Prey Client
 *
 *  01 - Main / Execution
 *
 */

// Module Requirements
var exec      = require('child_process').exec
  , sandbox   = require('sandboxed-module')
  , should    = require('should')
  , testUtils = require('./lib/test_utils');

// Test Variables
var mochaProcessArgv;

/**
 * Main Suite
 */
describe('## Main / Execution', function (){
  describe('### `prey` executable', testsPreyExecutable);
});

function testsPreyExecutable () {
  /**
   * @test  What happens when bin/prey is called without params?
   *        (cli.js should be called)
   */
  it( 'Should call `cli.js` when `bin/prey` is called without parameters'
    , function (done) {
    // Prepare mock test directory
    
    // Prepare mock `node` executable

    // Copy `bin/prey` there

    // Execute it...

    // ... And check the stdout

    throw "Not Implemented";
  });
}
