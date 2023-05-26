"use strict";

var
  exec = require('child_process').exec;

/**
 * Sample total network traffic,
 * Ignore iface, don't know how to get by adapter (yet).
 **/
exports.sample = function(iface,callback) {

  exec('netstat -e', function(err, stdout){
    if (err) return callback(err);

    var lines = stdout.toString().trim().split(/\n/);
    var stats = lines[4].split(/\s+/); // 5th line of output has send/receive stats

    var total_received = parseInt(stats[1]);
    var total_sent = parseInt(stats[2]);

    callback.data.sampled++;
    callback.data.received.push(total_received);
    callback.data.sent.push(total_sent);

    setTimeout(callback, 1000);
  });
};
