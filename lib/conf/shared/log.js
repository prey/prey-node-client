var fs      = require('fs'),
    join    = require('path').join,
    inspect = require('util').inspect,
    tmpdir  = process.platform == 'win32' ? process.env.WINDIR + '\\Temp' : '/tmp';

var stream;

function empty(msg) {
  return typeof msg == 'undefined' || msg === null || msg.toString().trim() == '';
}

module.exports = function(msg) {
  if (empty(msg)) return;

  if (!stream) {
    if (process.stdout && process.stdout.writable) {
      stream = process.stdout;
    } else {
      var fallback = join(tmpdir, 'prey-config.log');
      stream = fs.createWriteStream(fallback);
    }
  }

  if (!Buffer.isBuffer(msg) && typeof msg == 'object')
    msg = inspect(msg);

  stream.write(msg.toString() + "\n");
}
