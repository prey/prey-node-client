"use strict";

//////////////////////////////////////////
// Prey JS Remote Desktop Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var system = require('./../../../common').system;

exports.vnc_server_running = function(cb){
	system.process_running('x11vnc', cb);
};

exports.vnc_command = function(options){
	var str = 'x11vnc -ncache 10 -ncache_cr -localhost -forever'; // main
	str +=  ' -tightfilexfer -noxdamage -notruecolor'; // display
	if (options.desktop_scale) str +=  ' -scale 1/' + options.desktop_scale;
	if (options.view_only) str += ' -viewonly';
	if (options.vnc_pass) str += ' -passwd "' + options.vnc_pass + '"';
	return str;
};

/*
exports.stop_vnc = function(callback){
	exec(kickstart + ' -stop -deactivate', callback);
}
*/
