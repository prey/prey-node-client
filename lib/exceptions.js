var client  = require('needle'),
    release = require('os').release,
    host    = 'http://exceptions.preyproject.com',
    version = require('./common').version;

var opts = { 
  timeout: 5000 
}; 

exports.send = function(err, cb) {
  if (process.env.TESTING)
    return;

  if (!err instanceof Error)
    return cb && cb(new Error('Not an error.')); // paradox.

  var data = {
    'message'   : err.message,
    'backtrace' : err.stack, // .split('\n'),
    'cwd'       : process.cwd(),
    'language'  : 'node',
    'version'   : process.version,
    'framework' : 'Prey/' + common.version,
    'platform'  : process.platform,
    'release'   : os.release(),
    'user'      : process.env.USER || process.env.LOGNAME,
    'args'      : process.argv,
    'env'       : process.env,
    'gid'       : process.getgid && process.getgid(),
    'uid'       : process.getuid && process.getuid(),
    'pid'       : process.pid,
    'memory'    : process.memoryUsage()
  };

  client.post(host, data, opts, function(err, response) {
    cb && cb(err);
  });
};
