//////////////////////////////////////////
// Prey JS Desktop Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

exports.vnc_command = function(options){

	var str = 'x11vnc -ncache 10 -ncache_cr -localhost -noxdamage -forever -notruecolor';
	str += ' -scale 1/' + options.desktop_scale;
	if(options.password) str += ' -passwd "' + options.password + '"';
	if(options.viewonly) str += ' -viewonly';

	return str;

}
