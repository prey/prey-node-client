"use strict";

var
  exec = require('child_process').exec;

/**
 * 
 **/
 exports.sample = function(iface, callback) {

   var cmd = 'netstat -b -I ' + iface;

   exec(cmd, function(err, stdout){
     if (err) return callback(err);
     
     var str = stdout.toString().split('\n').splice(0)[1],
         cols = str.split(/\s+/);

     var total_sent = cols[9];
     var total_received = cols[6];

     callback.data.sampled++;
     callback.data.received.push(parseInt(total_received));
     callback.data.sent.push(parseInt(total_sent));

     setTimeout(callback, 1000);
   });

 };
