var exec = require('child_process').exec;

exports.get_picture = function(file, callback){

  var timer,
      running = true,
      picture_timeout = 10000;

  var child = exec('"' + __dirname + '/imagesnap" -w 1 ' + file, function(err, stdout, stderr) {
      running = false;
      if (timer) clearTimeout(timer);
      if (err) return callback(err);
      callback(null, 'image/jpeg');
  })

  // if after 10 seconds the picture hasn't been taken, cancel it.
  timer = setTimeout(function() {
    if (running) {
      child.kill();
    }
  }, picture_timeout);

}
