var ssh = require('winssh');

exports.ssh_server_running = function(callback){
  callback(server && server.readyState != 'closed');
};

exports.stop_ssh_server = function(cb){
  winssh.stop();
};

exports.start_ssh_server = function(opts, cb) {
  winssh.start(opts, cb)
}
