var is_windows = process.platform == 'win32';

// fix for https://github.com/joyent/node/issues/3584
// code from https://github.com/joyent/node/issues/3871
var exit = process.exit;

process.exit = function(code) {
  
  if (!is_windows)
    return exit(code);

  var draining = 0;
  var onDrain = function() {
    if (!draining--) exit(code);
  };

  if (process.stdout.bufferSize) {
    draining++;
    process.stdout.once('drain', onDrain);
  }

  if (process.stderr.bufferSize) {
    draining++;
    process.stderr.once('drain', onDrain);
  }

  if (!draining)
    exit(code);
}