var client     = require('needle'),
    host       = 'http://exceptions.preyproject.com',
    createHash = require('crypto').createHash;

var opts = {
  timeout: 4500
};

exports.send = function(err, cb) {

  // prevent exceptions from being sent when running tests
  if (process.env.TESTING)
    return cb && cb();

  var version = require('./common').version,
      os      = require('os'),
      release = os.release;

  if (!err instanceof Error)
    return cb && cb(new Error('Not an error.')); // paradox.

  var data = {
    'message'   : err.message,
    'backtrace' : err.stack, // .split('\n'),
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
    'memory'    : process.memoryUsage(),
    'hostid'    : getHostId()
  };

  function getHostId () {
    string = os.cpus()[0].model;
    string += Object.keys(os.networkInterfaces()).length;
    string += os.totalmem();
    return createHash('sha1').update(string).digest('hex');
  }

  client.post(host, data, opts, function(err, response) {
    cb && cb(err);
  });
};
