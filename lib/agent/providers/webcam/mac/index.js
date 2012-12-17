var exec = require('child_process').exec;

exports.get_picture = function(file, callback){

  exec(__dirname + '/imagesnap ' + file, function(err, stdout, stderr){
    callback(err, 'image/jpeg');
  })

}
