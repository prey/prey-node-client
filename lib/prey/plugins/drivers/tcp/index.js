this.on_demand = OnDemand.connect(options, function(stream){

	stream.on('command', function(command, data){
		self.handle_incoming_message(command, data);
	});

});