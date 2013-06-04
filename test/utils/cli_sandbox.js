var sandbox      = require('sandboxed-module'),
    path         = require('path'),
    agent_path   = path.resolve(__dirname, '..', '..', 'lib', 'agent');

var result = {
  out      : '', 
  code     : null,
  signals  : [], 
  triggers : [], 
  murders  : []
}

var defaults = { 
  common: {
    logger: { write: function(str){ result.out += str } },
    config: { present: function(){ return true } },
    system: { tempfile_path: function(file){ return file } }
  },
  agent: {
    run: function() { },
    running: function() { return true },
    engage: function(trigger) { result.triggers.push(trigger) },
    shutdown: function() { }
  },
  pid: {
    store: function(pidfile) { },
    remove: function(pidfile) { }
  },
  process: {
    env  : process.env,
    argv : [],
    stdout: { _type: '_tty' },
    exit: function(code){ result.code = code },
    on: function(signal, cb){ result.signals.push(signal) },
    kill: function(pid, signal) { result.murders.push(signal) }
  }
}

var merge = function(a, b) {
  if (!b) return a;
  
  for (var key in b) {
    // if (a[key])
      a[key] = b[key];
  }
  return a;
}

exports.run = function(opts) {
  var sandbox_opts = {
    requires : { 
      './common' : merge(defaults.common, opts.common),
      './'       : merge(defaults.agent, opts.agent),
    },
    globals  : { 
      process    : merge(defaults.process, opts.process) 
    }
  }

  // tris is a tricky one
  sandbox_opts.requires[path.join('..', 'utils', 'pidfile')] = merge(defaults.pid, opts.pid);

  // fire it up! 
  sandbox.require(path.resolve(agent_path, 'cli_controller'), sandbox_opts);

  // now let's see what happened.
  return result;
}