// This script lets us call programs as a local user rather than root.
// Usage: ./runner.js [user_name] [command] [arg1] [arg2] [arg3]

if (process.platform === 'win32') {
  process.exit(1);
}

const { spawn } = require('child_process');

let args = process.argv;
const sudoBin = '/usr/bin/sudo';

// eslint-disable-next-line no-unused-expressions
args.shift() && args.shift();

const runAs = args.shift();
let command = args.shift();

if (!runAs || !command) {
  console.log('Usage: runner.js [user_name] [command] <args>');
  process.exit(1);
}

const debugging = !!process.env.DEBUG || process.argv.indexOf('-D') !== -1;
const debug = debugging ? console.log : () => { };

const safeEscape = (str) => str.replace(/["`$|]/g, '\\$&');

const exit = (err, codeExit) => {
  let code = codeExit;
  if (err && !code) code = 1;
  setTimeout(() => {
    process.exit(code);
  }, 10);
};

const runCommand = (cmds, argument) => {
  debug(`Running ${cmds} with uid ${process.getuid()}`);
  const opts = { env: process.env };

  if (process.platform === 'linux' && !opts.env.DISPLAY) { opts.env.DISPLAY = ':0'; } // so it uses active display

  const child = spawn(cmds, argument, opts);

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });

  child.on('error', (err) => {
    console.log(`Error running command: ${err.message}`);
    exit(err);
  });

  child.on('exit', (code) => {
    debug(`Child exited with code ${code}`);
    exit(null, code);
  });
};

try {
  process.setuid(runAs);
  debug(`Switched to uid: ${process.getuid()}`);
} catch (err) {
  debug(`Unable to setuid. Falling back to sudo mode. Error was: ${err.message}`);
  args = args.map((a) => safeEscape(a));
  command = `${[`"${command}`].concat(args).join('" "')}"`;
  args = ['-n', 'su', runAs, '-c', command];
  command = sudoBin;
}

runCommand(command, args);
