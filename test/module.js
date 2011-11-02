var module_name = process.argv[2];

if(module_name == null || module_name == ""){
	console.log("No module name given");
	process.exit(1);
}

console.log("loading " + module_name);

var module = require(__dirname + '/../prey_modules/' + module_name);

module.run();

process.on('SIGINT', function () {
	log(' >> Got Ctrl-C!');
	module.stop();
});
