var inspect = require('util').inspect;

module.exports = function(msg) {
  if (!msg) return;

  if (typeof msg == 'object')
    msg = util.inspect(msg);

  if (process.stdout.writable)
    process.stdout.write(msg.toString() + "\n");
}