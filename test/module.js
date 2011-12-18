var module_name = process.argv[2];

if(module_name == null || module_name == ""){
	console.log("No module name given");
	process.exit(1);
}

console.log("loading " + module_name);

var mod = require(__dirname + '/../plugins/' + module_name);

mod.start({}, function(return_object){
	console.log(return_object);
});

process.on('SIGINT', function () {
	console.log(' >> Got Ctrl-C!');
	mod.stop();
});
