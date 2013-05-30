
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
      // This "time-bomb" will throw an exception
      if (process.argv.length > 3 && process.argv[3] === 'time_bomb') {
        var u = setTimeout(function() { throw 'TIME BOMB!'}, 800);
      }
    },
    running : (process.argv.length > 3 && process.argv[3] === 'exit_agent_running')? true : false,
    shutdown  : function() {
      if (process.argv.length > 3 && process.argv[3] === 'write_tmp_file')
        fs.writeFileSync(process.argv[4], 'SHUTDOWN!');
      return;
    }
  }

  var common = {
    logger      : {
      critical  : function(str) { var out = str; },
      debug     : function(str) { var out = str; },
      info      : function(str) { var out = str; },
      warn      : function(str) { var out = str; },
      write     : function(str) { var out = str; }
    },
    system  : {
      tempfile_path : function(file) { return file; }
    },
    config  : {
      get     : function(param) {
        if (process.argv.length > 4 && process.argv[4] === 'send_crash_reports') {
          if(param === 'send_crash_reports') return true;
        }
        return false;
      },
      present : function() {
        var config_exists = process.argv.length > 2 && process.argv[2] === 'config_present';
        return config_exists;
      }
    }
  }

  var exceptions = {
    send : function () {
      return process.exit(51);
    }
  }

  var pid = {
    store : function(file, callback) {
      if (process.argv.length > 3 && process.argv[3] === 'pidfile') {
        var running = {
          stat : {}
        }
        switch(process.argv[4]) {
          case 'later':
            running.stat.ctime = Date.now();
            return callback(null, running);
          break;
          case 'earlier':
            if (process.argv[5] === 'network') process.env.TRIGGER = true;
            running.pid = process.argv[6];
            running.stat.ctime = Date.now() - (2 * 60 * 1000 + 1);
            return callback(null, running);
          break;
        }
      } else {
        return callback();
      }
    },
    remove : function() {
      if (process.argv.length > 3 && process.argv[3].match(/write_tmp_file|exit_agent_running/))
        fs.writeFileSync(process.argv[4], 'REMOVE PID!');
    }
  }

  // The sandbox core of this file
  var sandbox_options = {
    requires              : {
      './'                : agent,
      './common'          : common,
      './exceptions'      : exceptions
    }
  }

  // This one is tricky: changes based on the OS
  sandbox_options['requires'][join('..', 'utils', 'pidfile')] = pid;

  // Now, we call this cli!
  var cli = sandbox.require(cli_path, sandbox_options);
}
