var fs      = require('fs'),
    join    = require('path').join,
    inspect = require('util').inspect,
    tmpdir  = process.platform == 'win32' ? process.env.WINDIR + '\\Temp' : '/tmp';

var stream;

function empty(msg) {
  return typeof msg == 'undefined' || msg === null || msg.toString().trim() == '';
}

function openFallback() {
  var fallback = join(tmpdir, 'prey-config.log');
  var s = fs.createWriteStream(fallback, { flags: 'a' });
  s.on('error', function() {});
  return s;
}

// Switches to the file fallback, destroying the previous stream if it was a
// file stream we own (never destroy process.stdout).
function switchToFallback() {
  var prev = stream;
  stream = openFallback();
  if (prev && prev !== process.stdout && typeof prev.destroy === 'function') {
    prev.destroy();
  }
}

module.exports = function(msg) {
  if (empty(msg)) return;

  if (!stream) {
    if (process.stdout && process.stdout.writable) {
      stream = process.stdout;
    } else {
      stream = openFallback();
    }
    stream.once('error', function() {
      switchToFallback();
    });
  }

  if (!Buffer.isBuffer(msg) && typeof msg == 'object')
    msg = inspect(msg);

  try {
    stream.write(msg.toString() + "\n");
  } catch (e) {
    if (e.code === 'EPIPE' || e.code === 'EIO') {
      switchToFallback();
    }
  }
}
