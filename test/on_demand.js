var common = require('./../lib/prey/common').load_config();
var OnDemand = require('./../lib/prey/on_demand');
var Prey = require('./../lib/prey');

process.env.DEBUG = true;

var options = {
	host: 'localhost',
	port: 9000
}

Prey.initialize_action_hooks();

var on_demand = OnDemand.connect(options, function(stream){

	stream.on('command', function(command, data){
		Prey.handle_incoming_message(command, data);
	});

});