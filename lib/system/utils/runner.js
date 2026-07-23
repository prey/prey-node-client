// This script lets us call programs as a local user rather than root.
// Usage: ./runner.js [user_name] [command] [arg1] [arg2] [arg3]

var cp       = require('child_process'),
    fs       = require('fs'),
    path     = require('path'),
    exec     = cp.exec,
    spawn    = cp.spawn,
    args     = process.argv,
    sudo_bin = '/usr/bin/sudo';

// On sudo-rs systems (Ubuntu 26+), 'su [A-z]*' wildcards are unsupported in sudoers.
// Use the prey-su wrapper instead, which validates the username without wildcards.
var prey_su_wrapper = path.join(__dirname, '..', 'linux', 'prey-su');

var use_wrapper = false;
try {
  var sudo_ver = cp.spawnSync('sudo', ['-V'], { timeout: 3000, encoding: 'utf8' });
  var sudo_output = (sudo_ver.stdout || '') + (sudo_ver.stderr || '');
  use_wrapper = sudo_output.toLowerCase().includes('sudo-rs');
} catch (e) {
  console.error('runner: could not detect sudo version, using traditional su fallback');
}

args.shift() && args.shift();

var run_as  = args.shift(),
    command = args.shift();

if (!run_as || !command) {
  console.log('Usage: runner.js [user_name] [command] <args>');
  process.exit(1);
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
    setTimeout(function(){
      process.exit(code);
    }, 10)
  })

  process.on('SIGTERM', function(){
    child.kill('SIGTERM');
  })

  process.on('SIGINT', function(){
    child.kill('SIGINT');
  })

}

var safe_escape = function(str) {
  return str.replace(/[\"\`\$\|]/g, "\\$&");
}

try {
  process.setuid(run_as);
  // console.log('New uid: ' + process.getuid());
} catch (err) {
  if (process.platform != 'win32') {
    args = args.map(function(a){ return safe_escape(a); })
    command = ['"' + command].concat(args).join('" "') + '"';
    if (use_wrapper && fs.existsSync(prey_su_wrapper)) {
      args = ['-n', prey_su_wrapper, run_as, '-c', command];
    } else {
      args = ['-n', 'su', run_as, '-c', command];
    }
    command = sudo_bin;
  }
}

run_command(command, args);
