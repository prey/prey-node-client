#!/usr/local/bin/node

// This script lets us call programs as a local user rather than root.
// Usage: ./runner.js [user_name] [command] [arg1] [arg2] [arg3]

var spawn = require('child_process').spawn;

var args = process.argv;
args.shift() && args.shift();

var run_as = args.shift();
var command = args.shift();

console.log('Current uid: ' + process.getuid());

try {
  process.setuid(run_as);
  // console.log('New uid: ' + process.getuid());
} catch (err) {
  console.log('Failed to set uid: ' + err);
}

console.log("Running " + command + " with uid " + process.getuid());

var child = spawn(command, args);

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

child.on('exit', function(code){
	process.exit(code);
})
