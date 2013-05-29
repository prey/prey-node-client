
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
  var fs            = require('fs'),
      join          = require('path').join,
      sandbox       = require('sandboxed-module'),
      cli_path      = join(__dirname, '..', '..', 'lib', 'agent', 'cli_controller.js');

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
      if (process.argv.length > 3 && process.argv[2] === 'write_tmp_file')
        fs.writeFileSync(process.argv[3], 'RUN!');
      // Need this timeout to keep the script alive
      var t = setTimeout(function() { }, 3600000);
    },
    shutdown  : function() {
      if (process.argv.length > 3 && process.argv[3] === 'write_tmp_file')
        fs.writeFileSync(process.argv[4], 'SHUTDOWN!');
      return;
    }
  }

  var common = {
    logger  : {
      warn  : function(str) { var out = str; },
      write : function(str) { var out = str; }
    },
    system  : {
      tempfile_path : function(file) { return file; }
    },
    config  : {
      present : function() {
        var config_exists = process.argv.length > 2 && process.argv[2] === 'config_present';
        return config_exists;
      }
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
      './common'          : common,
      '../utils/pidfile'  : pid
    }
  });
}
