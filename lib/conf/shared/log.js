var fs      = require('fs'),
    join    = require('path').join,
    inspect = require('util').inspect;

var stream; 

module.exports = function(msg) {
  if (!msg) return;

  if (!stream) {
    if (process.stdout.writable) {
      stream = process.stdout;
    } else {
      var fallback = join(require('os').tmpdir(), 'prey-config.log');
      stream = fs.createWriteStream(fallback);
    }
  }

  if (!Buffer.isBuffer(msg) && typeof msg == 'object')
    msg = inspect(msg);

  stream.write(msg.toString() + "\n");
}