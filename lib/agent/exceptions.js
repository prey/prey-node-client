var client = require('needle'),
    host = 'http://exceptions.preyproject.com',
    common = require('./common');

exports.send = function(err, cb){

  if (!err instanceof Error)
    return cb && cb(new Error('Not an error.'));

  var data = {
    "message": err.message,
    "backtrace": err.stack, // .split("\n"),
    "path": process.cwd(),
    "language": 'node',
    "version": process.version,
    "framework": 'Prey/' + common.version,
    "platform": common.os_name,
    "args": process.argv,
    "env": process.env,
    "gid": process.getgid(),
    "uid": process.getuid(),
    "pid": process.pid,
    "memory": process.memoryUsage()
  };

  client.post(host, data, function(err, response, body){
    cb && cb(err)
  });

};
