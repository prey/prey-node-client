var client = require('needle'),
    host   = 'http://exceptions.preyproject.com',
    common = require('./common');

exports.send = function(err, cb){

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
    'user'      : process.env.USER || process.env.LOGNAME,
    'args'      : process.argv,
    'env'       : process.env,
    'gid'       : process.getgid && process.getgid(),
    'uid'       : process.getuid && process.getuid(),
    'pid'       : process.pid,
    'memory'    : process.memoryUsage()
  };

  client.post(host, data, function(err, response, body){
    cb && cb(err);
  });

};
