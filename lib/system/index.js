var fs         = require('fs'),
    join       = require('path').join,
    cp         = require('child_process'),
    os_name    = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    remember   = require(join(__dirname,'..','utils','remember')),
    system     = require(join(__dirname, os_name)),
    logged_user;

var clean_string = function(str){
  return str.replace(/[^A-Za-z0-9\s]/g, '_').trim();
}

module.exports = system;
system.os_name = os_name;
system.paths   = require('./paths');
system.delay   = require(join(__dirname, os_name, 'delay'));

system.get_logged_user = remember(function(cb){

  system.find_logged_user(function(err, user){
    if (err || !user || user.trim() == '')
      return cb(err || new Error('No logged user detected.'));

    logged_user = user;
    cb(null, logged_user);
  })

});

system.tempfile_path = function(filename){
  return join(system.paths.temp, filename);
};

system.spawn_as_logged_user = function(command, args, callback){
  as_logged_user('spawn', command, args, callback);
}

system.run_as_logged_user = function(command, args, callback){
  as_logged_user('exec', command, args, callback);
};

system.get_running_user = function(){
  var s = process.env.USER     ||
          process.env.USERNAME ||
          process.env.LOGNAME  || 'System';
  return clean_string(s);
};

system.get_os_info = function(cb){
  var str = '';
  system.get_os_name(function(err, name){
    if (err) return cb(err);
    system.get_os_version(function(err, ver){
      if (err) return cb(err);
      var arch = process.arch == 'ia32' ? 'x86' : 'x64';
      cb(null, {name: name, version: ver, arch: arch});
    })
  })
}

var as_logged_user = function(type, bin, args, callback){

  var runner, command;

  system.get_logged_user(function(err, user){
    if (err) return callback(err);

    if (user == system.get_running_user()) {
      runner = bin;
      command = args;
    } else {
      if (os_name == 'windows') {
        runner = join(__dirname, 'windows', 'bin', 'userrun.exe');
        if (type == 'exec') runner = '"' + runner + '"';
        command = ['"' + bin + '"'].concat(args.map(function(x){ return '"' + x + '"'; }));
      } else {
        runner = join(__dirname, '..', 'utils', 'runner.js');
        command = [user, bin].concat(args);

        var node_bin = join(system.paths.package, 'bin', 'node');
        if (fs.existsSync(node_bin)) {
          command = [runner].concat(command);
          runner = node_bin;
        }
      }

    }

    if (type == 'spawn') {
      callback(null, cp.spawn(runner, command));
    } else {
      cp.exec(runner + ' ' + command.join(' '), callback);
    }
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
