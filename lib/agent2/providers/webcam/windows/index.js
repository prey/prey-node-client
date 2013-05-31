var exec = require('child_process').exec,
    join = require('path').join;

exports.get_picture = function(file, callback){

  var cmd = '"' + join(__dirname, '/prey-webcam.exe') + '"';
  cmd += ' -invalid youcam,cyberlink,google -frame 10 -outfile ' + file;

  exec(cmd, function(err) {
    callback(err, 'image/jpeg'); // if err exists, content_type will not matter
  })

}
