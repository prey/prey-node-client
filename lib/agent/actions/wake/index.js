"use strict";

var wol = require('wake_on_lan');

var wake = exports.start = function(options, cb){
	var mac = options.target_mac.replace('-', ':'); // replace just in case
	wol.wake(mac, cb);
};
