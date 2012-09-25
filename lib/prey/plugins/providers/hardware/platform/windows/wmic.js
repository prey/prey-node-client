"use strict";

/*
  wmic calls must always be serialised in windows, hence the use of async.queue
*/

Prey.err._set('NICLISTFULL','Nic list');
Prey.err._set('WMIC','Low level WMIC error');
             
var spawn = require('child_process').spawn,
    async = require('async'),
    fs = require('fs');

var removeTmpFile = function() {
  var tmp = 'TempWmicBatchFile.bat';
  if (fs.existsSync(tmp)) {
    fs.unlinkSync(tmp);
  }
};

var queue = async.queue(function(cmd,callback) {
  var wm = spawn("wmic",cmd.split(" "));
  var all = "";
  var err = null;
  
  wm.stdout.on('data',function(d) {
    all += d;
  });

  wm.stderr.on('data',function(e) {
    err = Prey.err._new('WMIC',cmd+":"+e);
  });
  
  wm.on('exit',function() {
    removeTmpFile();
    callback(err,all);
  });

  wm.stdin.end();

},1);

var run = exports.run = function(cmd,cb) {
  queue.push(cmd,cb);
};

exports.extractValue = function(str) {
  return (/\s+(\S*)/).exec(str)[1];
};

exports.nicListFull = function(cb) {
  run('nic list full',function(err,data) {
    if (err) {
      throw err;
    }
    
    cb(data.split(/\n\n|\n\r/g)
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
