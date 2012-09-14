

var spawn = require('child_process').spawn,
fs = require('fs');

exports.run = function(cmd,cb) {
  console.log("running "+cmd);
  var wm = spawn("wmic",cmd.split(" "));
  var all = "";

  wm.stdout.on('data',function(d) {
    all += d;
  });

  wm.stderr.on('data',function(data) {
    console.log('stderr: ' + data);
  });
  
  wm.on('exit',function(code) {
    var tmp = 'TempWmicBatchFile.bat';
    if (fs.existsSync(tmp)) {
      fs.unlinkSync(tmp);
    }
    cb(all);
  });


  wm.stdin.end();

};


