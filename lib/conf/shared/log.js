var fs      = require('fs'),
    join    = require('path').join,
    inspect = require('util').inspect,
    tmpdir  = process.platform == 'win32' ? process.env.WINDIR + '\\Temp' : '/tmp';

var stream;

module.exports = function(msg) {
  if (!msg) return;

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
