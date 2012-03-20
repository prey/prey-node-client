var common = require('./../lib/prey/common').load_config();

var module_name = process.argv[2];

if(module_name == null || module_name == ""){
	console.log("No module name given");
	process.exit(1);
}

var parse_options = function(){

	if(!process.argv[3]) return {};

	var args = process.argv[3];

	try{
		var formatted = args.trim().replace(/([\w\.]+)/g,'"$1"').replace(/ /g, ',');
		return JSON.parse("{" + formatted + "}");
	} catch(e){
		console.log("Invalid argument format.");
		return {};
	}

};

console.log("loading " + module_name);

var mod = require(__dirname + '/../lib/prey/plugins/actions/' + module_name);

var opts = parse_options();

var instance = mod.start(opts, function(err){
	console.log(err);
});

if(instance && mod.events){

	mod.events.forEach(function(ev){

		instance.on(ev, function(data){
			console.log("Event triggered " + ev);
			if(data) console.log(data);
		});

	});

}

process.on('SIGINT', function () {
	console.log(' >> Got Ctrl-C!');
	try {
		mod.stop();
	} catch(e) {
		console.log("Action is not stoppable!");
	}
	process.exit(1);
});
