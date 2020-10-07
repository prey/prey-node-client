var fs        = require('fs'),
    join      = require('path').join,
    exec      = require('child_process').exec,
    common    = require('./../../../common'),
    temp_path = common.system.tempfile_path;

exports.get_picture = function(callback){

  var exes = ['/prey-webcam.exe', '/snapshot.exe'],
      opts = [' -invalid youcam,cyberlink,google -frame 10 -outfile ', ' /T '],
      file = temp_path('picture.' + process.pid + '.jpg');

  var picture_command = function(index) {
    return '"' + join(__dirname, exes[index]) + '"' +  opts[index] + file;
  }

  var take_picture = function(method) {
    exec(picture_command(method), function(err) {
      if (method == 1) file = file +'.jpg';
      if (!fs.existsSync(file) && method == 0) {
        file = file.replace(/.jpg/g, '');
        take_picture(1);

      } else {
        callback(null, file, 'image/jpeg');
      }
    })
  }

  fs.unlink(file, function() {
    take_picture(0);
  })

}