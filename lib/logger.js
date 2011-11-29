var util = require('util');
var set_color = require("ansi-color").set;

GLOBAL.log = function(msg, color){
	if(color)
		console.log(set_color(msg, color));
	else
		console.log(msg)
}

GLOBAL.debug = function(msg){
	if(!process.env.DEBUG) return;
	if (typeof msg == 'object')
		util.debug(util.inspect(msg));
	else
		util.debug(msg)
}

//GLOBAL.inspect = function(obj){
//	util.inspect(obj);
//}
