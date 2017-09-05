var fs   = require('fs'),
    exec = require('child_process').exec,
    join = require('path').join;

exports.get_picture = function(file, callback){

  var exes = ['/prey-wecam.exe', '/snapshot.exe'],
      opts = [' -invalid youcam,cyberlink,google -frame 10 -outfile ', ' /T '];

  var picture_command = function(index) {
    return '"' + join(__dirname, exes[index]) + '"' +  opts[index] + file;
  }

  var take_picture = function(method) {
    exec(picture_command(method), function(err) {
      if (!fs.existsSync(file) && method == 0) {
        file = file.replace(/.jpg/g, '');
        take_picture(1);
      } else
        callback(err, 'image/jpeg'); // if err exists, content_type will not matter
    })
  }

  fs.unlink(file, function() {
    take_picture(0);
  })

}