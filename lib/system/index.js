var fs         = require('fs'),
    dns        = require('dns'),
    join       = require('path').join,
    cp         = require('child_process'),
    async      = require('async'),
    os_name    = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    remember   = require(join(__dirname,'..','utils','remember')),
    system     = require(join(__dirname, os_name)),
    logged_user;

var clean_string = function(str){
  return str.replace(/[^A-Za-z0-9\s]/g, '_').trim();
}

var capitalize = function(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = system;
system.os_name = os_name;
system.paths   = require('./paths');

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

system.get_os_info = remember(function(cb){
  var done,
      data = {};
  
  data.arch = process.arch == 'x64' ? 'x64' : 'x86';

  async.parallel([
      system.get_os_name,
      system.get_os_version
  ], function(err, results){
    if (done) return;

    data.name = results[0] ? capitalize(results[0]) : os_name;
    if (results[1]) data.version = results[1];

    cb(err, data);
    done = true;
  });
})

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
  });
};