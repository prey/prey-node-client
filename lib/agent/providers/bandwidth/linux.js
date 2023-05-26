"use strict";

var
  exec = require('child_process').exec;

/**
 *
 **/
exports.sample = function(iface, callback) {

  exec('cat /proc/net/dev | grep ' + iface, function(err, stdout){

    if (err) return callback(err);

    var stats = stdout.toString().trim().split(/\s+/);
    // var mtu = stats[1];
    var total_received = parseInt(stats[1]);
    var total_sent = parseInt(stats[9]);

    callback.data.sampled++;
    callback.data.received.push(total_received);
    callback.data.sent.push(total_sent);

    setTimeout(callback, 1000);
  });

};
