var http = require('http');

var server;

function open(port, res) {
  server = http.createServer();

  server.on('request', res);
  server.listen(port);
  return server;
}

function close(cb) {
  if (server) server.close(cb);
}

exports.open = open;
exports.close = close;
