var client = require('needle'),
    host = 'http://exceptions.preyproject.com',
    common = require('common'),
    logger = common.logger;

exports.send = function(err){

  var data = {
    "message": err.message,
    "backtrace": error.stack, // .split("\n"),
    "path": process.cwd(),
    "language": 'node',
    "version": process.version,
    "framework": 'Prey/' + common.version,
    "platform": common.os_name,
    "args": process.argv,
    "env": process.env
    "gid": process.getgid(),
    "uid": process.getuid(),
    "pid": process.pid,
    "memory": process.memoryUsage()
  };

  client.post(host, data, function(err, response, body){

    if (err) logger.error('Could not notify exception: ' + err.message);
    else logger.info(body);

  });

};
