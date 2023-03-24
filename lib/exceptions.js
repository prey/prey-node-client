const client  = require('needle'),
    host      = 'https://exceptions.preyproject.com',
    common    = require('./common'),
    logger = common.logger.prefix('exceptions');

exports.send = function(err, cb) {

  // prevent exceptions from being sent when running tests
  if (process.env.TESTING) 
    return cb && cb();

  var version = require('./common').version,
      release = require('os').release,
      keys    = require('./agent/plugins/control-panel/api/keys');

  if (!err instanceof Error)
    return cb && cb(new Error('Not an error.')); // paradox.
  
  logger.error(err.message);

  var data = {
    'message'   : err.message,
    'backtrace' : err.stack, // .split('\n'),
    'deviceKey' : keys.get().device,
    'cwd'       : process.cwd(),
    'language'  : 'node',
    'version'   : process.version,
    'framework' : 'Prey/' + version,
    'platform'  : process.platform,
    'release'   : release(),
    'user'      : process.env.USER || process.env.LOGNAME,
    'args'      : process.argv,
    'env'       : process.env,
    'gid'       : process.getgid && process.getgid(),
    'uid'       : process.getuid && process.getuid(),
    'pid'       : process.pid,
    'memory'    : process.memoryUsage()
  };

  client.post(host, data, 
    {
      content_type: 'application/json',
      timeout: 4500 
    }, function(err, response) {
    cb && cb(err);
  });
};