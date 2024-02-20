const fs = require('fs');
const { join } = require('path');
const { inspect } = require('util');

const tmpdir = process.platform === 'win32' ? `${process.env.WINDIR}\\Temp` : '/tmp';

let stream;

const empty = (msg) => (typeof msg === 'undefined' || msg === null || msg.toString().trim() === '');

module.exports = (message) => {
  let msg = message;
  let fallback;
  if (empty(msg)) return;

  if (!stream) {
    if (process.stdout && process.stdout.writable) {
      stream = process.stdout;
    } else {
      fallback = join(tmpdir, 'prey-config.log');
      stream = fs.createWriteStream(fallback);
    }
  }

  if (!Buffer.isBuffer(msg) && typeof msg === 'object') msg = inspect(msg);

  stream.write(`${msg.toString()}\n`);
};
