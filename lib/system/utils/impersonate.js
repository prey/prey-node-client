const fs = require('fs');
const { join } = require('path');
const { spawn, exec } = require('child_process');

const runner = join(__dirname, 'runner.js');

// eslint-disable-next-line consistent-return
const isAbsoluteNode = () => {
  const node = process.argv[0];
  if (node.match('node') && fs.existsSync(node)) return node;
};

exports.spawnAs = (user, command, args, cb) => {
  let out;
  let child;
  let bin = runner;
  let fullCmd = [user, command].concat(args);
  const node = isAbsoluteNode();

  if (node) {
    fullCmd = [bin].concat(fullCmd);
    bin = node;
  }

  const done = (e) => {
    if (out) return;
    out = true;
    cb(e, child);
  };

  child = spawn(bin, fullCmd);
  child.on('error', done);
  process.nextTick(done);
};

exports.execAs = (user, command, cb) => {
  let fullCmd = [runner, user, command];
  const bin = isAbsoluteNode();

  if (bin) fullCmd = [bin].concat(fullCmd);

  exec(fullCmd.join(' '), (e, out, err) => {
    let except = e;
    if (!except && err.match('a password is required')) {
      except = new Error(`Unable to impersonate ${user}`);
    }
    cb(except, out, err);
  });
};
