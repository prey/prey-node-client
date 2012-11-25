"use strict";

var wol = require('wake_on_lan');

var wake = exports.start = function(options, cb){
  if (!options || !options.target || !options.mac)
    return cb(new Error('Target MAC needed'));

  var mac = options.target || options.mac;
	mac = mac.replace('-', ':'); // replace just in case
	wol.wake(mac, cb);
};
