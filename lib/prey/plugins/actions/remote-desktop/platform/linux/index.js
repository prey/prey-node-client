//////////////////////////////////////////
// Prey JS Desktop Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

exports.vnc_command = function(options){

	var str = 'x11vnc -ncache 10 -ncache_cr -localhost -forever'; // main
	str += ' -tightfilexfer -noxdamage -notruecolor'; // display
	str += ' -scale 1/' + options.desktop_scale;
	// if(options.vnc_pass != '') str += ' -passwd "' + options.vnc_pass + '"';
	if(options.view_only) str += ' -viewonly';

	return str;

}
