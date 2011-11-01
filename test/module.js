var module_name = process.argv[2];

console.log("loading " + module_name);

var module = require(__dirname + '/../prey_modules/' + module_name);

module.start();

process.on('SIGINT', function () {
	log(' >> Got Ctrl-C!');
	module.stop();
});
