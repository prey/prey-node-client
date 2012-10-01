"use strict";

/*
  wmic calls must always be serialised in windows, hence the use of async.queue
*/
             
var spawn = require('child_process').spawn,
    async = require('async'),
    fs = require('fs');

var removeTmpFile = function() {
  var tmp = 'TempWmicBatchFile.bat';
  if (fs.existsSync(tmp)) {
    fs.unlinkSync(tmp);
  }
};


/**
 * Need to split a command line string taking into account strings - that is, don't
 * split spaces within a string. So that 'P1 P2 "Other Param" P4' is split into 4 param strings
 * with param 3 = "Other Param" (not including quotes).
 **/
var splitter = function(cmd) {
  cmd = cmd.trim();
  
  var acc = [], inString = false, cur = "", l = cmd.length;

  for (var i = 0 ; i < l ; i++ ){
    var ch = cmd.charAt(i);
    switch(ch) {
    case '"':
      inString = !inString;
      if (!inString) {
        if (cur.length > 0) {
          acc.push(cur);
          cur = "";
        }
      }
      break;
    case ' ':
      if (inString) {
        cur += ' ';
      } else {
        if (cur.length > 0) {
          acc.push(cur);
          cur = "";
        }
      }
      break;
    default:
      cur += ch;
      break;
    }
  }

  if (cur.length > 0) acc.push(cur);
  
  return acc;
};

var queue = async.queue(function(cmd,callback) {
  var wm = spawn("wmic",splitter(cmd));
  var all = "";
  var err = null;
  
  wm.stdout.on('data',function(d) {
    all += d;
  });

  wm.stderr.on('data',function(e) {
    err = _error('WMIC',cmd+": "+e);
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

exports.nicListFull = function(callback) {
  run('nic list full',function(err,data) {
    if (err) return callback(err);
    
    callback(null,data.split(/\n\n|\n\r/g)
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
