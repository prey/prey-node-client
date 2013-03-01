/**
 *  Load dependencies
 */
var fs        = require('fs'),
    path      = require('path'),
    sandbox   = require('sandboxed-module'),
    should    = require('should'),
    join      = require('path').join;

// Module variables
var mochaProcessArgv;
var modifiedCLIFile;

/**
 *  THE TESTS SUITES
 */
describe('prey.js', function (){
  before(getMochaArgv);

  describe('Command line options', function () {
    describe('--path',    testsCLIOptionsPath);
    describe('--driver', testsCLIOptionsDriver);
    //describe('--logfile', testsCLIOptionsLogFile);
    //describe('--setup', testsCLIOptionsSetup);
  });
});

/**
 *  THE TESTS THEMSELVES
 */
function testsCLIOptionsPath () {
  /**
   * @test
   *
   * @summary A config file must be set by default (no `--path` param given)
   */
  it('should set config file path by default (no parameters)', function () {
    var defaultConfigRoute = path.resolve(__dirname, '..', 'prey.conf.default');
    // `lib/common.js` does the job, we need to check that
    var common = require('../lib/common');

    should.exists(common.default_config_file);
    common.default_config_file.should.eql(defaultConfigRoute);
  });

  /**
   * @test
   *
   * @summary A config file will be set, given `--path` parameter.
   */
  it('should set config file given by `--path`', function (done) {
    var originalConfigFile
      , tmpConfigFile;

    // This one should exist
    originalConfigFile = path.resolve(__dirname, '..', 'prey.conf.default');
    fs.stat(originalConfigFile, gotFileStats);

    function gotFileStats (err, stat) {
      if (err) throw err;
      // Create a config file at `/tmp`
      tmpConfigFile = path.resolve('/tmp', 'prey.conf')
      copyFile(originalConfigFile, tmpConfigFile, onCopiedFile);

    }

    function onCopiedFile (err) {


      if (err) throw err;

      // Set up the `--path` parameter
      process.argv[2] = '--path';
      process.argv[3] = '/tmp';

      // Create a local instance of `commander` to inject into `common`
      var program = require('commander');
      program
      .option('-p, --path <path>', 'Path to config file [/etc/prey or C:\\$WINDIR\\Prey]')
      .parse(process.argv)

      // `lib/common.js` does the job, we need to check that
      // Create the object with dependency injections
      var common = sandbox.require('../lib/common', {
        requires              : {
          'commander'         : program
        }
      });

      // The test...
      should.exists(common.config._values);
      should.exists(common.config._values.host);
      common.config._values.host.should.eql('control.preyproject.com');
      should.exists(common.config._values.campfire.token);
      common.config._values.campfire.token.should.eql('USER_TOKEN');      

      // And delete the args and the file
      process.argv = process.argv.splice(0,2);
      fs.unlinkSync(tmpConfigFile);

      done();
    }
  });

  /**
   * @test
   *
   * @summary Checks if prey exits when it can't find
   *          the config file. This function rests on
   *          `common.config.present()`
   */
  it('should exit when no config file is found', function (done) {
    // Let's create a `cli` file for testing purposes
    // We must extract the first line, since it has a shebang `#!`
    var cliPath = join(__dirname, '..', 'lib', 'agent', 'cli.js');
    var buffer = fs.readFileSync(cliPath);
    var newline = ['\r'.charCodeAt(0), '\n'.charCodeAt(0)];
    var i = 0;
    while (newline.indexOf(buffer[i]) === -1) { i++; }
    var restOfTheFile = buffer.slice(i + 1, buffer.length).toString('utf-8');

    var randomNumber = Math.floor(1000000000 * Math.random()).toString()
    var newFileName = join('/tmp', randomNumber + '_lib_agent_cli.js');
    fs.writeFileSync(newFileName, restOfTheFile);

    modifiedCLIFile = newFileName;

    // Overwrite logger
    // We are interested on what it outputs, so we enqueue its messages
    var myStdOutMessages = new Array();
    var myLogger = {
      warn  : function (message) { myStdOutMessages.push('logger-warn: ' + message); }
    , info  : function (message) { myStdOutMessages.push('logger-info: ' + message); }
    , write : function (message) { myStdOutMessages.push('logger-write: ' + message); }
    }

    // We need this custom object to capture the calls to `process`
    // inside the module
    var myProcessObj = {
      argv                  : process.argv,
      emit                  : process.emit,
      env                   : {
        ROOT_PATH           : process.env.ROOT_PATH
      },
      exit                  : myProcessObjExit,
      on                    : process.on
    }

    function myProcessObjExit (code) {
      myStdOutMessages.push('-- process.exit() have been called with the code: ' + code);
    }

    // The last step is overwrite `common` function `present()`
    var myCommon = require(join('..','lib','agent','common'));
    myCommon.config.present = function () { return false; }
    myCommon.logger = myLogger;

    // Create the cli object with dependency injections
    var cli = sandbox.require(modifiedCLIFile, {
      requires              : {
        '/package'          : require(join('..','package.json')),
        'commander'         : require('commander'),
        '../utils/pidfile'  : require('../lib/utils/pidfile'),
        './'                : {
          run               : function fakeRun () { console.log('Fake run!'); },
          shutdown          : function fakeShutDown () { console.log('Fake shutdown!'); }
        },
        './common'          : myCommon
      },
      globals               : {
        process             : myProcessObj
      }
    });

    // The test itself
    // Note that `myStdOutMessages` depends on what do
    // we choose to outpu.
    myStdOutMessages.should.have.length(2)
    myStdOutMessages[0].should.eql('logger-write: '
      + '\nNo config file found. Please run bin/prey config.\n');
    myStdOutMessages[1].should.eql(
      '-- process.exit() have been called with the code: 1' );

    // Delete the file at the end of this test
    fs.unlinkSync(modifiedCLIFile);

    done();
  });
}

function testsCLIOptionsDriver () {

  it('should set the driver by default', function (done) {
    throw 'Not Implemented';
  });

  it('should set driver given by `--driver`', function (done) {

  });
}

/**
 *  AUXILIAR FUNCTIONS
 */

/**
 * @summary Stores mocha commander arguments, and deletes them
            must be done previous any test, since prey client
            relies on visionmedia's commander also
 */
function getMochaArgv () {
  mochaProcessArgv  = process.argv;
  process.argv = mochaProcessArgv.splice(0,2);
}

/**
 * @param   {String}    srcPath
 * @param   {String}    dstPath
 * @param   {Callback}  cb
 *
 * @summary Copy file async
 */
function copyFile (srcPath, dstPath, cb) {
  var cbCalled = false;

  var rd = fs.createReadStream(srcPath);

  rd.on("error", function(err) {
    done(err);
  });

  var wr = fs.createWriteStream(dstPath);

  wr.on("error", function(err) {
    done(err);
  });

  wr.on("close", function(ex) {
    done();
  });

  rd.pipe(wr);

  function done(err) {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
}

/**

describe('signals', function(){
describe('when SIGUSR1 is received', function(){
describe('when SIGUSR2 is received', function(){
describe('when SIGINT signal is received', function(){
describe('when SIGTERM signal is received', function(){
describe('when SIGQUIT signal is received', function(){
describe('when pidfile exists', function(){
describe('when pidfile does NOT exist', function(){
it('should launch the setup routine', function(){
it('should not continue with the rest of the process', function(){
it('should verify that the driver actually exists', function(){
it('should use that driver', function(){
it('should not save to config when exiting', function(){
it("should set program's log output path", function(){
it('should run the setup process', function(){
it('should call agent.engage()', function(){
it('should pass "network" as an argument to engage()', function(){
it('should pass "trigger" as an argument to engage()', function(){
it('should check if pidfile exists', function(){
it('should poke the other instance', function(){
it('should exit', function(){
it('should store the PID in the pidfile', function(){
it('should run the main process', function(){

**/
