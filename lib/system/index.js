var fs      = require('fs'),
    join    = require('path').join,
    cp      = require('child_process'),
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    system  = require(join(__dirname, os_name));

module.exports = system;
system.os_name = os_name;
system.paths   = require('./paths');
system.delay   = require(join(__dirname, os_name, 'delay'));

/**
 * Callsback name of currently logged in user.
 **/
system.logged_user = function(callback){

  module.exports.get_logged_user(function(err, user_name) {
    if (err) return callback(err);

    if (user_name && user_name !== '')
      callback(null, user_name.split("\n")[0].trim());
    else
      callback(new Error('No logged user found.'));
  });
};

system.tempfile_path = function(filename){
  return join(system.paths.temp, filename);
};

system.spawn_as_logged_user = function(command, args, callback){
  as_logged_user('spawn', command, args, callback);
}

system.run_as_logged_user = function(command, args, callback){
  as_logged_user('exec', command, args, callback);
};

var as_logged_user = function(type, bin, args, callback){

  var runner;

  system.logged_user(function(err, user){
    if (err) return callback(err);

    if (os_name == 'windows')
      runner = join(__dirname, 'windows', 'bin', 'userrun.exe');
    else
      runner = join(__dirname, '..', 'utils', 'runner.js');

    var command = [user, bin].concat(args);

    if (type == 'spawn')
      return callback(null, cp.spawn(runner, command));
    else
      cp.exec(runner + ' ' + command.join(' '), callback);
  })

};

system.set_interval = function(requested_delay, cb){

  var current;

  var update_delay = function(delay){
    system.delay.set(delay, function(err){
      cb(err, current);
    })
  }

	system.delay.get(function(current_delay){

    current = current_delay && current_delay.value;

		// if current delay is every 60 minutes
		if (current_delay && current_delay.one_hour) {

			// and a lower one was requested, set it
			if (requested_delay < 60)
				return update_delay(requested_delay)

		} else { // if current delay is not every 60 min

			// and no delay is set or requested delay is different, set it
			if (!current_delay || parseInt(current_delay.value) != requested_delay)
				return update_delay(requested_delay);

		}

		cb();

	});

}

system.unset_interval = function(cb){
  system.delay.unset(cb);
}
