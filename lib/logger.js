var util = require('util');

GLOBAL.log = function(msg){
	console.log(msg)
}

GLOBAL.debug = function(msg){
	if(!args.get('debug')) return;
	if (typeof msg == 'object')
		util.debug(util.inspect(msg));
	else
		util.debug(msg)
}

//GLOBAL.inspect = function(obj){
//	util.inspect(obj);
//}

GLOBAL.quit = function(msg){
	log(" !! " + msg)
	process.exit(1)
}
