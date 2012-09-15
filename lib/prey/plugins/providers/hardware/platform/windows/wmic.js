

/*
  wmic calls must always be serialised in windows, hence the use of async.queue
*/

var spawn = require('child_process').spawn,
    async = require('async'),
    fs = require('fs');

var queue = async.queue(function(cmd,callback) {
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
    callback(all);
  });

  wm.stdin.end();

},1);


exports.run = function(cmd,cb) {
  queue.push(cmd,cb);
};


 
 

