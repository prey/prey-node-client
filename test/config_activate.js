/**
 * TEST
 *
 * Prey Client
 *
 * CONFIGURATION
 * [./bin/prey] config activate
 *
 */

// Module Requirements
var should = require('should');

describe('[./bin/prey] config activate', function () {
  // Suite variables
  var my_std_out_messages = new Array();
  var my_log = function (msg) {
    my_std_out_messages.push(msg);
  }

  it('Should load `lib/conf/cli.js` on `config activate` command');

  it('Should not do anything if `process.env.BUNDLE_ONLY is on`', function (done) {
    // Key variable
    process.env.BUNDLE_ONLY = true;
    // Require the controller and call the function
    var common         = require('../lib/common');
    var cli_controller =
      require('../lib/conf/cli_controller')(my_log, common, on_activate_called);
    cli_controller.activate();

    function on_activate_called (err, msg) {
      if (err) my_std_out_messages.push('ERR: ' + err.message);
      if (msg) my_std_out_messages.push('MSG: ' + msg);
      if (arguments.length === 0) my_std_out_messages.push('OK');
      // The test
      my_std_out_messages.should.have.length(1);
      my_std_out_messages[0].should.be.equal('OK');
      // Are we done yet? Let's clean the variable
      delete process.env.BUNDLE_ONLY;
      done();
    }
  });

  it('Should setup version and interval on `controller#activate` call`');
  it('Should `install` a new version, and update the system');
  it('Should go to `controller#show_gui_and_exit` when -g flag is called');
});