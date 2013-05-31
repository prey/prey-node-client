var exec = require('child_process').exec;

exports.get_picture = function(file, callback){

  var running = true,
      picture_timeout = 10000;

  var child = exec(__dirname + '/imagesnap ' + file, function(err, stdout, stderr){
      running = false;
      if (err) return callback(err);
      callback(null, 'image/jpeg');
  })

  // if after 10 seconds the picture hasn't been taken, cancel it.
  setTimeout(function(){
    if (running){
      child.kill();
    }
  }, picture_timeout);

}
