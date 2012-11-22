var system = require('./common').system;

exports.set = function(requested_delay, cb){

  var current;

  var set_delay = function(delay){
    system.set_new_delay(delay, function(err){
      cb(err, current);
    })
  }

	system.get_current_delay(function(current_delay){

    current = current_delay;

		// if current delay is every 60 minutes
		if (current_delay.one_hour) {

			// and a lower one was requested, set it
			if (requested_delay < 60)
				update_delay(requested_delay)

		} else { // if current delay is not every 60 min

			// and no delay is set or requested delay is different, set it
			if (!current_delay.value || parseInt(current_delay.value) != requested_delay)
				update_delay(requested_delay);

		}

	});

}
