

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


var run = exports.run = function(cmd,cb) {
  queue.push(cmd,cb);
};


exports.nicListFull = function(cb) {
  run('nic list full',function(data) {
    cb(data
       .split(/\n\n|\n\r/g)
       .filter(function(block) { return block.length > 2; })
       .map(function(block) {
         return block
           .split(/\n+|\r+/)
           .filter(function(line) { return line.length > 0 ;})
           .reduce(function(o,line) {
             var kv = line.split("=");
             o[kv[0]] = kv[1];
             return o;
           },{});
       }));
  });
};
