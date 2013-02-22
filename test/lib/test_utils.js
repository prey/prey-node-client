
/**
 * @param   {Object}  process
 *
 * @summary Stores mocha commander arguments, and deletes them
 *          must be done previous any test, since prey client
 *          relies on visionmedia's commander also
 */
exports.getMochaArgv = function (process) {
  var mochaProcessArgv  = process.argv;
  process.argv          = mochaProcessArgv.splice(0,2);

  return { process          : process
         , mochaProcessArgv : mochaProcessArgv };
}

/**
 * @param   {String}  dstDir
 *
 * @summary Creates an executable mock `node` file
 *          which outputs the parameters used to call it
 */
exports.createMockNodeExecFile = function (dstDir) {
  var fileContents = '#!/bin/bash\necho "-- ARGV: " $@';


}
