var util = require('util');

GLOBAL.log = function(msg){
	console.log(msg)
}

GLOBAL.debug = function(msg){
	if(args.get('debug')) util.debug(msg)
}

GLOBAL.quit = function(msg){
	log(" !! " + msg)
	process.exit(1)
}

GLOBAL.inspect = function(obj){
	util.inspect(obj);
}
