var util = require('util'),
	common = require('./../lib/prey/common').load_config();

var provider_name = process.argv[2];

if(provider_name == null || provider_name == ""){
	console.log("No provider name given");
	process.exit(1);
}

console.log("Loading " + provider_name);

var provider = require(__dirname + '/../lib/prey/plugins/providers/' + provider_name);

provider.getters.forEach(function(data){

	console.log("Requesting " + data)

	provider.get(data, function(err, result){

		console.log(" - Got " + data + " -> " + util.inspect(result));

	});

});
