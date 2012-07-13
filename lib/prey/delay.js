var common = require('./common'),
    os = common.os,
    logger = common.logger;

exports.set = function(requested_delay){

	var set_new_delay = function(delay){

		os.set_new_delay(parseInt(delay), function(err){
			if(err) logger.error("Delay not set: " + err.toString());
			else logger.info("[agent] Delay succesfully set.");
		});

	};

	os.get_current_delay(function(current_delay){

		if(!current_delay.value)
			logger.warn("[agent] No delay found! Never ran Prey as " + process.env.RUNNING_USER + "?")
		else
			logger.info("[agent] Current delay: " + current_delay.value + ", requested: " + requested_delay);

		// if current delay is every 60 minutes
		if(current_delay.one_hour){

			// and a lower one was requested, set it
			if(requested_delay < 60)
				set_new_delay(requested_delay)

		} else { // if current delay is not every 60 min

			// and no delay is set or requested delay is different, set it
			if(!current_delay.value || parseInt(current_delay.value) != requested_delay)
				set_new_delay(requested_delay);

		}

	});

}
