#!/usr/bin/env node

var wipe  = require('./wipe'),
    what  = process.argv;

var last_err;

what.shift();
what.shift();

what.forEach(function(item) {
  wipe[item](function(err) {
    if (err) last_err = err;
  })
})

process.on('exit', function(code) {
  process.exit(last_err ? 1 : 0);
})