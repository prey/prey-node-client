
/**
 * Encapsulates in a sandbox the `lib/agent/cli_controller.js`
 * for testing purposes.
 *
 * Since mocha recurses over the directory of this file,
 * we need to wrap the code using the function `test`.
 *
 * The code inside this file will be executed, if we call this file using
 * [node] <filename>
 *
 **/

if (process.argv[0] === 'node' && process.argv[1].match(/lib_agent_cli/)) test();

function test() {
  // Module requirements
  var join      = require('path').join, 
      sandbox   = require('sandboxed-module'),
      cli_path  = join(__dirname, '..', '..', 'lib', 'agent', 'cli_controller.js')

  // Dependencies to be injected
  var agent = {
    engage    : function (code) {
      if (code === 'interval') {
        return process.exit(41);
      } else if (code === 'network') {
        return process.exit(42);
      }      
    },
    run       : function() {
      // Need this timeout to keep the script alive
      var t = setTimeout(function() { }, 3600000);
    },
    shutdown  : function() {
      return;
    }
  }

  var pid = {
    store : function(file, callback) {
      return callback();
    }
  }

  // The sandbox core of this file
  var cli = sandbox.require(cli_path, {
    requires              : {
      './'                : agent,
      '../utils/pidfile'  : pid
    }
  });
}
