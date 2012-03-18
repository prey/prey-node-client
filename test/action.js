var common = require('./../lib/prey/common').load_config();

var module_name = process.argv[2];

if(module_name == null || module_name == ""){
	console.log("No module name given");
	process.exit(1);
}

console.log("loading " + module_name);

var mod = require(__dirname + '/../lib/prey/plugins/actions/' + module_name);

mod.start({}, function(err){
	console.log(err);
});

(mod.events || []).forEach(function(ev){
	mod.on(ev), function(data){
		console.log("Event triggered " + ev);
		if(data) console.log(data);
	}
})

process.on('SIGINT', function () {
	console.log(' >> Got Ctrl-C!');
	try {
		mod.stop();		
	} catch(e) {
		console.log("Action is not stoppable!");
	}
	process.exit(1);
});
