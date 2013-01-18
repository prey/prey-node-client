var net = require('net'),
	spawn = require('child_process').spawn,
	server, child,
	logger = require('./../../../common').logger;


exports.ssh_server_running = function(callback){
  callback(server && server.readyState != 'closed');
};

exports.stop_ssh_server = function(callback){
	server && server.close();
};
	
exports.start_ssh_server = function(callback){

  server = net.createServer(function(socket){

    logger.info('New session!')

    child = spawn('cmd.exe');
  	// socket.write('C:\\>');

  	child.stdout.on('data', function(data){
  	  if (socket.readyState != 'closed')
  	    socket.write(data)
  	});

  	socket.on('data', function(data){

  	  if (child.stdin.destroyed)
  	    process.stdin.resume();
  	
  	  child.stdin.write(data);
  	})
  	
  	child.on('error', function(err){
  	    logger.error(err)
  	})

    child.stdin.on('end', function () {
      logger.debug('stdin closed');
    });

  	child.on('exit', function(){
  	  socket.end();
  	})
  	
  	socket.on('close', function(){
  	  logger.debug('Local tunnel disconnected')
  	})

  	socket.on('error', function(err){
  	  logger.error(err.message);
  	})

  })

  server.listen(22);

}