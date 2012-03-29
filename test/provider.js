var util = require('util'),
	common = require('./../lib/prey/common').load_config();

var provider_name = process.argv[2];

var load_provider = function(provider_name){

	console.log("Loading " + provider_name);

	var provider = require(__dirname + '/../lib/prey/plugins/providers/' + provider_name);

	provider.getters.forEach(function(data){

		console.log("Requesting " + data)

		provider.get(data, function(err, result){

			if(err) console.log(' !! Error for ' + data + ' -> ' + err.toString())
			else console.log(" -- Got " + data + " -> " + util.inspect(result));

		});

	});


}

if(provider_name == null || provider_name == ""){
	console.log("No provider name given");
	process.exit(1);
} else if(provider_name == 'all'){
	
	require('fs').readdir(__dirname + '/../lib/prey/plugins/providers/', function(err, list){

		list.forEach(function(p){
			load_provider(p);
		})

	})
	
} else {
	load_provider(provider_name);
}