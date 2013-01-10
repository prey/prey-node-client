#!/usr/bin/env node

// This script lets us call programs as a local user rather than root.
// Usage: ./runner.js [user_name] [command] [arg1] [arg2] [arg3]

var cp       = require('child_process')
    exec     = cp.exec,
    spawn    = cp.spawn,
    args     = process.argv,
    sudo_bin = '/usr/bin/sudo';

args.shift() && args.shift();

var run_as = args.shift(),
    command = args.shift();

if (!run_as || !command) {
  console.log('Usage: runner.js [user_name] [command] <args>');
  process.exit(1);
}

var get_logged_user_pid = function(user, cb){
  exec("ps aux | grep -v grep | grep loginwindow | grep " + user + " | awk '{print $2}'", function(err, out){
      cb(err, out && out.toString().trim());
  });
}

// console.log('Current uid: ' + process.getuid());

var run_command = function(command, args){

  // console.log("Running " + command + " with uid " + process.getuid());

  var opts = { env: process.env }

  if (process.platform == 'linux' && !opts.env.DISPLAY)
    opts.env.DISPLAY = ':0'; // so it uses active display

  var child = spawn(command, args, opts);

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  child.on('exit', function(code){
    process.nextTick(function(){
      process.exit(code);
    })
  })

  process.on('SIGTERM', function(){
    child.kill('SIGTERM');
  })

  process.on('SIGINT', function(){
    child.kill('SIGINT');
  })

}

try {
  process.setuid(run_as);
  // console.log('New uid: ' + process.getuid());
} catch (err) {
   if (process.platform == 'darwin') {
    get_logged_user_pid(run_as, function(err, pid){
      if (err || pid.toString().trim() == '') 
        throw(err || 'User ' + run_as + ' not logged in.');

      args = ['launchctl', 'bsexec', pid, command].concat(args);
      run_command(sudo_bin, args);
    })
  } else {
    if (process.platform == 'linux') {
      command = ['"' + command].concat(args).join('" "') + '"';
      args = ['su', run_as, '-c', command];
      command = sudo_bin;
    }
    run_command(command, args);
  }
}
